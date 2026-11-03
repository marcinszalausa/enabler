-- Additive rollout: deploy this migration before the application changes.
-- Legacy two-argument RPCs remain for in-flight workers during deployment.
create schema if not exists private;

alter table public.generations add column request_options jsonb;

create table private.generation_credit_ledger (
  generation_id uuid not null references public.generations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null check (kind in ('charge', 'refund')),
  amount integer not null,
  created_at timestamptz not null default now(),
  primary key (generation_id, kind),
  check ((kind = 'charge' and amount > 0) or (kind = 'refund' and amount >= 0))
);
create index generation_credit_ledger_workspace_idx
  on private.generation_credit_ledger(workspace_id, created_at);
alter table private.generation_credit_ledger enable row level security;
revoke all on private.generation_credit_ledger from public, anon, authenticated, service_role;

-- A request UUID is also the generation UUID. Repeating the same request returns
-- the same generation, even if its charge consumed the remaining balance.
create function public.reserve_generation(
  ws uuid, request_id uuid, product uuid, generation_type text,
  generation_model text, amount integer, options jsonb
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
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
  if balance < amount then return null; end if;

  insert into public.generations(id, workspace_id, product_id, type, model, cost_credits, request_options)
    values(request_id, ws, product, generation_type, generation_model, amount, options);
  update public.workspaces set credits = credits - amount where id = ws;
  insert into private.generation_credit_ledger(generation_id, workspace_id, kind, amount)
    values(request_id, ws, 'charge', amount);
  return request_id;
end;
$$;

-- Closing a generation, its refund and the ledger receipt commit together.
-- The first terminal outcome wins; retries cannot issue an additional refund.
create function public.finalize_generation(
  generation_id uuid, final_status public.generation_status, refund integer,
  failure_message text default null, output_prompt text default null
)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  g public.generations%rowtype;
begin
  if generation_id is null or refund is null or refund < 0
    or final_status is null or final_status not in ('succeeded','failed') then
    raise exception 'Invalid generation settlement' using errcode = '22023';
  end if;
  select generation.* into g from public.generations generation
    where generation.id = generation_id for update;
  if not found then raise exception 'Generation not found' using errcode = '22023'; end if;
  if refund > g.cost_credits then
    raise exception 'Refund exceeds generation charge' using errcode = '22023';
  end if;
  if g.status not in ('queued','running') then return false; end if;
  if final_status = 'failed' and refund <> g.cost_credits then
    raise exception 'Failed generations require a full refund' using errcode = '22023';
  end if;

  if refund > 0 then
    update public.workspaces set credits = credits + refund where id = g.workspace_id;
  end if;
  -- A zero refund still records settlement. Old in-flight video runs may have
  -- been charged by the legacy RPC and therefore have no charge ledger entry.
  insert into private.generation_credit_ledger(generation_id, workspace_id, kind, amount)
    values(g.id, g.workspace_id, 'refund', refund);
  update public.generations set status = final_status, error = failure_message,
    prompt = coalesce(output_prompt, prompt) where id = g.id;
  return true;
end;
$$;

revoke execute on function public.reserve_generation(uuid,uuid,uuid,text,text,integer,jsonb)
  from public, anon, authenticated;
revoke execute on function public.finalize_generation(uuid,public.generation_status,integer,text,text)
  from public, anon, authenticated;
grant execute on function public.reserve_generation(uuid,uuid,uuid,text,text,integer,jsonb) to service_role;
grant execute on function public.finalize_generation(uuid,public.generation_status,integer,text,text) to service_role;
