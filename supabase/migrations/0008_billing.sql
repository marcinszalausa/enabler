-- Billing: Stripe subscriptions and one-time credit packs. Plan and credits
-- still change only from the server (service role); the browser can read
-- them, never write them.

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

-- One-time credit packs, one row per paid Checkout Session. The primary key
-- makes a pack add its credits once, however often Stripe sends the event.
create table public.credit_purchases (
  checkout_session_id text primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  credits integer not null check (credits > 0),
  created_at timestamptz not null default now()
);
alter table public.credit_purchases enable row level security;

create function public.grant_pack_credits(ws uuid, session_id text, amount integer)
returns void
language sql
security definer
set search_path = ''
as $$
  with bought as (
    insert into public.credit_purchases (checkout_session_id, workspace_id, credits)
    values (session_id, ws, amount)
    on conflict (checkout_session_id) do nothing
    returning workspace_id, credits
  )
  update public.workspaces w
  set credits = w.credits + bought.credits
  from bought
  where w.id = bought.workspace_id;
$$;

revoke execute on function public.grant_pack_credits(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.grant_pack_credits(uuid, text, integer) to service_role;
