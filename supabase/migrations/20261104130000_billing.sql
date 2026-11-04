-- Billing: Stripe subscriptions (Starter and Growth, monthly or yearly) and
-- one-time credit packs. Plan and credits still change only from the server
-- (service role); the browser can read them, never write them.

alter table public.workspaces
  add column stripe_customer_id text unique,
  add column stripe_subscription_id text,
  add column subscription_status text,
  add column current_period_end timestamptz,
  -- 'month' or 'year' for the subscription on file.
  add column billing_interval text,
  -- Set once a workspace has had a paid plan (the money-back guarantee is for
  -- the first payment).
  add column had_subscription boolean not null default false,
  -- Credit rollover bookkeeping, kept by grant_plan_credits():
  -- plan_allowance: the size of the last monthly grant;
  -- plan_expiring: credits from the grant before it, still unused, which
  --   lapse at the next grant;
  -- plan_baseline: the balance right after the last grant (plus packs since),
  --   so the next grant can tell how much was spent in between.
  add column plan_allowance integer not null default 0,
  add column plan_expiring integer not null default 0,
  add column plan_baseline integer not null default 0,
  -- Yearly plans: when the next month's credits are due.
  add column next_credit_at timestamptz;

-- Stripe event ids already handled, so retried webhooks don't apply twice.
-- RLS on with no policies: only the service role can read or write it.
create table public.stripe_events (
  id text primary key,
  type text not null,
  created_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;

-- One row per monthly plan grant (a paid invoice, or a month of a yearly
-- plan), so a grant applies once however often it is retried.
create table public.plan_credit_grants (
  grant_key text primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  credits integer not null,
  expired integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.plan_credit_grants enable row level security;

-- A new month of plan credits. Unused credits from the previous month roll
-- over once; credits that already rolled over and are still unused lapse.
-- Spending is counted against the oldest plan credits first, then the newer
-- ones, then free and pack credits, which never lapse.
create function public.grant_plan_credits(
  ws uuid, grant_key text, allowance integer, next_credit timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.workspaces%rowtype;
  spent integer;
  lapse integer;
  carry integer;
begin
  if allowance is null or allowance <= 0 then
    raise exception 'Invalid allowance' using errcode = '22023';
  end if;
  select * into w from public.workspaces where id = ws for update;
  if not found then return; end if;

  insert into public.plan_credit_grants (grant_key, workspace_id, credits)
  values (grant_key, ws, allowance)
  on conflict do nothing;
  if not found then return; end if;

  spent := greatest(0, w.plan_baseline - w.credits);
  lapse := least(w.credits, greatest(0, w.plan_expiring - spent));
  carry := least(
    w.credits - lapse,
    greatest(0, w.plan_allowance - greatest(0, spent - w.plan_expiring))
  );

  update public.plan_credit_grants
  set expired = lapse
  where plan_credit_grants.grant_key = grant_plan_credits.grant_key;

  update public.workspaces
  set credits = w.credits - lapse + allowance,
      plan_allowance = allowance,
      plan_expiring = carry,
      plan_baseline = w.credits - lapse + allowance,
      next_credit_at = coalesce(next_credit, workspaces.next_credit_at)
  where id = ws;
end;
$$;

-- An upgrade mid-month (Starter to Growth): add the difference between the
-- plans' allowances now; the next monthly grant is the new plan's.
create function public.grant_plan_upgrade(ws uuid, grant_key text, allowance integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.workspaces%rowtype;
  extra integer;
begin
  select * into w from public.workspaces where id = ws for update;
  if not found then return; end if;
  extra := allowance - w.plan_allowance;
  if extra <= 0 then return; end if;

  insert into public.plan_credit_grants (grant_key, workspace_id, credits)
  values (grant_key, ws, extra)
  on conflict do nothing;
  if not found then return; end if;

  update public.workspaces
  set credits = credits + extra,
      plan_allowance = allowance,
      plan_baseline = plan_baseline + extra
  where id = ws;
end;
$$;

-- Yearly plans are paid once a year but get their credits month by month.
-- Run daily (see /api/cron/plan-credits). The renewal invoice covers the
-- first month of each new year.
create function public.grant_due_yearly_credits()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  w record;
  granted integer := 0;
begin
  for w in
    select id, stripe_subscription_id, plan_allowance, next_credit_at
    from public.workspaces
    where billing_interval = 'year'
      and stripe_subscription_id is not null
      and subscription_status in ('active', 'trialing')
      and plan_allowance > 0
      and next_credit_at <= now()
      and next_credit_at < current_period_end
  loop
    perform public.grant_plan_credits(
      w.id,
      w.stripe_subscription_id || ':' || to_char(w.next_credit_at at time zone 'utc', 'YYYY-MM-DD'),
      w.plan_allowance,
      w.next_credit_at + interval '1 month'
    );
    granted := granted + 1;
  end loop;
  return granted;
end;
$$;

revoke execute on function public.grant_plan_credits(uuid, text, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.grant_plan_credits(uuid, text, integer, timestamptz) to service_role;
revoke execute on function public.grant_plan_upgrade(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.grant_plan_upgrade(uuid, text, integer) to service_role;
revoke execute on function public.grant_due_yearly_credits() from public, anon, authenticated;
grant execute on function public.grant_due_yearly_credits() to service_role;

-- One-time credit packs, one row per paid Checkout Session. The primary key
-- makes a pack add its credits once, however often Stripe sends the event.
-- Pack credits never lapse.
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
  set credits = w.credits + bought.credits,
      plan_baseline = w.plan_baseline + bought.credits
  from bought
  where w.id = bought.workspace_id;
$$;

revoke execute on function public.grant_pack_credits(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.grant_pack_credits(uuid, text, integer) to service_role;
