begin;
-- One starter allowance per verified email and per user. Existing balances stay intact.
-- Keep only a hash for replay detection; claims intentionally survive account deletion.
lock table auth.users in share row exclusive mode;
create table private.trial_credit_claims(
 email_hash bytea primary key,
 user_id uuid not null unique,
 claimed_at timestamptz not null default now()
);
alter table private.trial_credit_claims enable row level security;
revoke all on private.trial_credit_claims from public, anon, authenticated, service_role;
insert into private.trial_credit_claims(email_hash,user_id)
 select sha256(convert_to(lower(btrim(email)),'UTF8')),id from auth.users
 where nullif(btrim(email),'') is not null
 order by created_at,id
 on conflict do nothing;

-- Workspaces themselves no longer create money. A privileged, verified signup
-- grants the one-time allowance to its first workspace exactly once.
alter table public.workspaces alter column credits set default 0;
revoke insert, delete, truncate, references, trigger on public.workspaces from public, anon, authenticated;
revoke update on public.workspaces from public, anon;
revoke all on private.trial_credit_claims from public, anon, authenticated, service_role;

create function private.grant_starter_credits(account_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
 email_key bytea;
 target_ws uuid;
 claimed uuid;
begin
 select sha256(convert_to(lower(btrim(u.email)),'UTF8')) into email_key
 from auth.users u where u.id=account_id and u.email_confirmed_at is not null
 and nullif(btrim(u.email),'') is not null;
 if email_key is null then return; end if;
 select id into target_ws from public.workspaces where owner_id=account_id order by created_at,id limit 1 for update;
 if target_ws is null then return; end if;
 insert into private.trial_credit_claims(email_hash,user_id) values(email_key,account_id)
 on conflict do nothing returning user_id into claimed;
 if claimed is not null then
  update public.workspaces set credits=credits+100 where id=target_ws;
 end if;
end;
$$;
revoke all on function private.grant_starter_credits(uuid) from public,anon,authenticated,service_role;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path='' as $$
declare ws_id uuid;
begin
 insert into public.workspaces(name,owner_id,credits)
 values(coalesce(split_part(new.email,'@',1),'My')||'''s workspace',new.id,0) returning id into ws_id;
 insert into public.workspace_members(workspace_id,user_id,role) values(ws_id,new.id,'owner');
 if new.email_confirmed_at is not null then perform private.grant_starter_credits(new.id); end if;
 return new;
end;
$$;
revoke all on function public.handle_new_user() from public,anon,authenticated,service_role;

create function private.handle_email_verified()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform private.grant_starter_credits(new.id);
 return new;
end;
$$;
revoke all on function private.handle_email_verified() from public,anon,authenticated,service_role;
create trigger on_auth_email_verified after update of email_confirmed_at on auth.users
 for each row when(old.email_confirmed_at is null and new.email_confirmed_at is not null)
 execute function private.handle_email_verified();

create index generations_workspace_created_idx on public.generations(workspace_id,created_at);

create or replace function public.reserve_generation(
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
$$;

commit;
