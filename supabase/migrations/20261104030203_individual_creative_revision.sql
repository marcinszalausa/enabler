-- Single-ad revisions reuse the existing immutable reservation and ledger.
CREATE OR REPLACE FUNCTION public.reserve_generation(ws uuid, request_id uuid, product uuid, generation_type text, generation_model text, amount integer, options jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  existing public.generations%rowtype;
  balance integer;
begin
  if request_id is null or ws is null or product is null
    or amount is null or amount <= 0
    or generation_type is null or generation_type not in ('image_ads','video_ads')
    or generation_model is null or options is null or jsonb_typeof(options) <> 'object' then
    raise exception 'Invalid generation request' using errcode = '22023';
  end if;

  -- Serializes balance changes and retries within a workspace.
  select w.credits into balance from public.workspaces w where w.id = ws for update;
  if not found then
    raise exception 'Workspace not found' using errcode = '22023';
  end if;

  select g.* into existing from public.generations g where g.id = request_id;
  if found then
    if existing.workspace_id <> ws or existing.product_id is distinct from product
      or existing.type <> generation_type or existing.model is distinct from generation_model
      or existing.cost_credits <> amount or existing.request_options is distinct from options then
      raise exception 'Request ID was already used for different inputs' using errcode = '22023';
    end if;
    return existing.id;
  end if;

  if not exists (select 1 from public.products p where p.id = product and p.workspace_id = ws) then
    raise exception 'Product does not belong to workspace' using errcode = '22023';
  end if;

  -- A revision must use a saved ad from the same workspace and product.
  if options ? 'revision' then
    if jsonb_typeof(options->'revision') is distinct from 'object'
      or options->'revision'->>'version' is distinct from '1'
      or coalesce(options->'revision'->>'source_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(options->'revision'->'direction') is distinct from 'string'
      or length(btrim(options->'revision'->>'direction')) not between 1 and 240 then
      raise exception 'Invalid revision source' using errcode='22023';
    end if;
    if not exists (
      select 1 from public.creatives c join public.generations g on g.id=c.generation_id
      where c.id=(options->'revision'->>'source_id')::uuid
        and c.workspace_id=ws and g.workspace_id=ws and g.product_id=product
        and g.status='succeeded'
        and c.kind::text=options->'revision'->>'kind'
        and c.aspect=options->'revision'->>'aspect'
        and c.storage_path=options->'revision'->>'storage_path'
        and c.storage_path like ws::text||'/%'
        and generation_type=case when c.kind::text='image' then 'image_ads' else 'video_ads' end
    ) then raise exception 'Invalid revision source' using errcode='22023'; end if;
  end if;

  if balance < amount then return null; end if;
  -- The workspace row is already locked. Limits cannot race between requests.
  -- Existing request retries return above before any limit, preserving idempotency.
  if exists(select 1 from public.workspaces where id=ws and plan='free') then
    if exists(select 1 from public.generations where workspace_id=ws and status in ('queued','running')) then
      raise exception 'TRIAL_BATCH_ACTIVE' using errcode='P0001';
    end if;
    if (select count(*) from public.generations where workspace_id=ws and created_at>now()-interval '1 hour') >= 10 then
      raise exception 'TRIAL_BATCH_RATE' using errcode='P0001';
    end if;
  end if;

  insert into public.generations(id, workspace_id, product_id, type, model, cost_credits, request_options)
    values(request_id, ws, product, generation_type, generation_model, amount, options);
  update public.workspaces set credits = credits - amount where id = ws;
  insert into private.generation_credit_ledger(generation_id, workspace_id, kind, amount)
    values(request_id, ws, 'charge', amount);
  return request_id;
end;
$function$
;
revoke all on function public.reserve_generation(uuid,uuid,uuid,text,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.reserve_generation(uuid,uuid,uuid,text,text,integer,jsonb) to service_role;

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
    expected := case when g.request_options->'revision'->>'version' = '1' then 1
      when g.type = 'image_ads'
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
