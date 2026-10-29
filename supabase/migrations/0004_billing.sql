-- Milestone 2: Stripe subscriptions. Plan and credits still change only from
-- the server (service role); the browser can read them, never write them.

alter table public.workspaces
  add column stripe_customer_id text unique,
  add column stripe_subscription_id text,
  add column subscription_status text,
  add column current_period_end timestamptz;

-- Stripe event ids already handled, so retried webhooks don't apply twice.
-- RLS on with no policies: only the service role can read or write it.
create table public.stripe_events (
  id text primary key,
  type text not null,
  created_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;

-- Tops the balance up to the plan's monthly allowance. Unused credits don't
-- pile up past the allowance, and a balance above it is never cut.
create function public.grant_plan_credits(ws uuid, allowance integer)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.workspaces
  set credits = greatest(credits, allowance)
  where id = ws;
$$;

revoke execute on function public.grant_plan_credits(uuid, integer) from public, anon, authenticated;
grant execute on function public.grant_plan_credits(uuid, integer) to service_role;
