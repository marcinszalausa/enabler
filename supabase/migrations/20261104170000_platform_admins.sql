-- Gooidy staff who may open the admin dashboard (/dashboard/admin).
-- Rows are added by hand in the Supabase SQL editor, never from the app:
--   insert into private.platform_admins(user_id)
--   select id from auth.users where email = 'someone@example.com';
create table if not exists private.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table private.platform_admins enable row level security;
revoke all on private.platform_admins from public, anon, authenticated;

-- Only the server (service role) asks, after verifying the signed-in user.
create or replace function public.is_platform_admin(uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select uid is not null and exists (select 1 from private.platform_admins where user_id = uid);
$$;
revoke all on function public.is_platform_admin(uuid) from public, anon, authenticated;
grant execute on function public.is_platform_admin(uuid) to service_role;

-- Credits charged and refunded per workspace from the private ledger,
-- optionally since a moment (null = all time).
create or replace function public.admin_credit_totals(since timestamptz default null)
returns table (workspace_id uuid, charged bigint, refunded bigint)
language sql stable security definer set search_path = '' as $$
  select l.workspace_id,
    coalesce(sum(l.amount) filter (where l.kind = 'charge'), 0)::bigint,
    coalesce(sum(l.amount) filter (where l.kind = 'refund'), 0)::bigint
  from private.generation_credit_ledger l
  where since is null or l.created_at >= since
  group by l.workspace_id;
$$;
revoke all on function public.admin_credit_totals(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_credit_totals(timestamptz) to service_role;
