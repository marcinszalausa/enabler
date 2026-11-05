-- Credits that Gooidy admins add to (or take from) a customer's workspace by
-- hand on the admin dashboard. Every change is kept here with who made it.
create table if not exists private.admin_credit_grants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  admin_id uuid references auth.users(id) on delete set null,
  amount integer not null check (amount <> 0 and amount between -100000 and 100000),
  note text not null default '' check (length(note) <= 200),
  balance_after integer not null,
  created_at timestamptz not null default now()
);
create index if not exists admin_credit_grants_workspace on private.admin_credit_grants(workspace_id, created_at desc);
alter table private.admin_credit_grants enable row level security;
revoke all on private.admin_credit_grants from public, anon, authenticated;

-- Called by the server with the service key, for an admin it has verified.
-- Checks the admin again here and never lets a balance go below zero.
create or replace function public.admin_grant_credits(ws uuid, admin uuid, amount integer, note text)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  result integer;
begin
  if not public.is_platform_admin(admin) then
    raise exception 'Not an admin' using errcode = '42501';
  end if;
  if amount is null or amount = 0 or amount < -100000 or amount > 100000 then
    raise exception 'Invalid amount' using errcode = '22023';
  end if;
  update public.workspaces set credits = credits + amount where id = ws returning credits into result;
  if not found then raise exception 'Workspace not found' using errcode = '22023'; end if;
  if result < 0 then raise exception 'NEGATIVE_BALANCE' using errcode = 'P0001'; end if;
  insert into private.admin_credit_grants(workspace_id, admin_id, amount, note, balance_after)
  values (ws, admin, amount, left(coalesce(note, ''), 200), result);
  return result;
end;
$$;
revoke all on function public.admin_grant_credits(uuid, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.admin_grant_credits(uuid, uuid, integer, text) to service_role;

-- Grant history: one workspace, or every workspace when ws is null.
create or replace function public.admin_credit_grant_history(ws uuid default null)
returns table (id uuid, workspace_id uuid, admin_email text, amount integer, note text, balance_after integer, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select g.id, g.workspace_id, u.email::text, g.amount, g.note, g.balance_after, g.created_at
  from private.admin_credit_grants g left join auth.users u on u.id = g.admin_id
  where ws is null or g.workspace_id = ws
  order by g.created_at desc
  limit 500;
$$;
revoke all on function public.admin_credit_grant_history(uuid) from public, anon, authenticated;
grant execute on function public.admin_credit_grant_history(uuid) to service_role;
