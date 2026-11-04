-- Image runs can make 1, 3 or 5 ad ideas, each in two sizes. The sweep that
-- settles interrupted runs reads the run's own idea count (older runs made 5).
create or replace function private.recover_stale_generations(batch_size integer default 100)
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
    expected := case when g.type = 'image_ads'
      then 2 * case when g.request_options->>'ideas' in ('1','3','5')
        then (g.request_options->>'ideas')::integer else 5 end
      else 2 end;
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

revoke all on function private.recover_stale_generations(integer) from public, anon, authenticated, service_role;
