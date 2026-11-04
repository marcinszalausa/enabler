-- Quality promise: when an image ad doesn't match the real product, the owner
-- can recreate it free, up to three times per calendar month (UTC).
-- The redo's credits are granted and charged in one transaction, so the ledger
-- still records an ordinary charge for the run.
create table if not exists private.free_redos (
  generation_id uuid primary key references public.generations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  credits integer not null check (credits > 0),
  granted_at timestamptz not null default now()
);
create index if not exists free_redos_workspace_month on private.free_redos(workspace_id, granted_at);
alter table private.free_redos enable row level security;
revoke all on private.free_redos from public, anon, authenticated;

create or replace function public.free_redos_left(ws uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select greatest(0, 3 - count(*)::integer) from private.free_redos
  where workspace_id = ws and granted_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc';
$$;
revoke all on function public.free_redos_left(uuid) from public, anon, authenticated;
grant execute on function public.free_redos_left(uuid) to service_role;

create or replace function public.reserve_free_redo(ws uuid, request_id uuid, product uuid, generation_model text, amount integer, options jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  result uuid;
begin
  if ws is null or request_id is null or amount is null or amount <= 0 or amount > 10
    or options is null or jsonb_typeof(options->'revision') is distinct from 'object'
    or options->'revision'->>'kind' is distinct from 'image'
    or options->>'free_redo' is distinct from 'true' then
    raise exception 'Invalid free redo' using errcode = '22023';
  end if;
  -- Same lock order as reserve_generation: the workspace row first.
  perform 1 from public.workspaces where id = ws for update;
  if not found then raise exception 'Workspace not found' using errcode = '22023'; end if;
  -- A retry of a redo already granted returns the same run without a new grant.
  if exists (select 1 from private.free_redos where generation_id = request_id) then
    return public.reserve_generation(ws, request_id, product, 'image_ads', generation_model, amount, options);
  end if;
  if public.free_redos_left(ws) < 1 then
    raise exception 'FREE_REDO_LIMIT' using errcode = 'P0001';
  end if;
  update public.workspaces set credits = credits + amount where id = ws;
  result := public.reserve_generation(ws, request_id, product, 'image_ads', generation_model, amount, options);
  if result is null or result <> request_id then
    raise exception 'Invalid free redo' using errcode = '22023';
  end if;
  insert into private.free_redos(generation_id, workspace_id, credits) values (request_id, ws, amount);
  return result;
end;
$$;
revoke all on function public.reserve_free_redo(uuid,uuid,uuid,text,integer,jsonb) from public, anon, authenticated;
grant execute on function public.reserve_free_redo(uuid,uuid,uuid,text,integer,jsonb) to service_role;
