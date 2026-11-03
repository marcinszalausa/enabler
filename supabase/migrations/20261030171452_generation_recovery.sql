-- Apply before application deployment. No AI requests are replayed by recovery.
alter table public.generations add column started_at timestamptz;
alter table public.generations add column recovered_at timestamptz;

create function private.stamp_generation_start()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'queued' and new.status = 'running' then
    new.started_at := clock_timestamp();
  end if;
  return new;
end;
$$;
revoke all on function private.stamp_generation_start() from public, anon, authenticated, service_role;
create trigger generation_start_time before update of status on public.generations
for each row execute function private.stamp_generation_start();

-- Fences delayed output writes against terminal settlement. All writers and
-- the recovery sweep serialize on the parent generation, not a browser timer.
create function private.guard_generation_output()
returns trigger language plpgsql security definer set search_path = '' as $$
declare g public.generations%rowtype;
begin
  select * into g from public.generations where id = new.generation_id for update;
  if not found or g.workspace_id <> new.workspace_id
    or g.status not in ('queued','running') then
    raise exception 'Generation is closed or belongs to another workspace' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_generation_output() from public, anon, authenticated, service_role;
create trigger guard_generation_output before insert on public.creatives
for each row execute function private.guard_generation_output();

-- Stable storage paths identify outputs, including an interrupted video edit.
create unique index creatives_generation_path_unique on public.creatives(generation_id,storage_path);
create index generations_recovery_idx on public.generations
  ((coalesce(started_at,created_at))) where status in ('queued','running');

create function private.recover_stale_generations(batch_size integer default 100)
returns integer language plpgsql set search_path = '' as $$
declare
  g public.generations%rowtype;
  expected integer;
  delivered integer;
  refund integer;
  recovered integer := 0;
  closed boolean;
begin
  if batch_size is null or batch_size < 1 or batch_size > 500 then
    raise exception 'Invalid recovery batch size' using errcode = '22023';
  end if;
  -- No caller-controlled clock or age threshold. SKIP LOCKED makes overlapping
  -- sweeps harmless and avoids waiting on workers already committing outputs.
  for g in
    select * from public.generations
    where status in ('queued','running')
      and type in ('image_ads','video_ads')
      and cost_credits > 0
      and coalesce(started_at,created_at) < clock_timestamp() -
        case when status = 'queued' or type = 'image_ads'
          then interval '15 minutes' else interval '2 hours' end
    order by coalesce(started_at,created_at),id
    limit batch_size for update skip locked
  loop
    expected := case when g.type = 'image_ads' then 10 else 2 end;
    -- Unknown pricing requires operator review, never an invented refund.
    if g.cost_credits % expected <> 0 then continue; end if;
    select count(*) into delivered from public.creatives
      where generation_id = g.id and workspace_id = g.workspace_id
        and kind::text = case when g.type = 'image_ads' then 'image' else 'video' end;
    if delivered > expected then continue; end if;
    refund := g.cost_credits - delivered * (g.cost_credits / expected);
    closed := public.finalize_generation(
      g.id,
      case when delivered > 0 then 'succeeded'::public.generation_status
        else 'failed'::public.generation_status end,
      refund,
      case when delivered = expected then null
        when delivered > 0 then 'This run was interrupted. Saved ads were kept and undelivered ads were refunded.'
        else 'This run was interrupted. Its credits were refunded. Please try again.' end,
      null
    );
    if closed then
      update public.generations set recovered_at = clock_timestamp() where id = g.id;
      recovered := recovered + 1;
    end if;
  end loop;
  return recovered;
end;
$$;
-- Private, invoker-only operation run by the database scheduler as postgres.
revoke all on function private.recover_stale_generations(integer) from public, anon, authenticated, service_role;

-- Supabase provides pg_cron; vanilla PostgreSQL CI does not. Enable and schedule
-- where supported, and explicitly verify cron.job at production rollout.
do $schedule$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    execute $command$select cron.schedule(
      'recover-stale-generations','*/5 * * * *',
      'select private.recover_stale_generations(100);'
    )$command$;
  else
    raise notice 'pg_cron unavailable: recovery schedule not installed on this database';
  end if;
end;
$schedule$;
