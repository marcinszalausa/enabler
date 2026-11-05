-- Auto-reload: buy a credit pack automatically, with the saved card, when the
-- balance falls below a threshold the owner picks. At most one reload runs at
-- a time, and at most four a month, so a busy day can't run up a large bill.
alter table public.workspaces
  add column auto_reload_enabled boolean not null default false,
  add column auto_reload_threshold integer not null default 50
    check (auto_reload_threshold between 1 and 10000),
  add column auto_reload_pack text not null default 'small'
    check (auto_reload_pack in ('small', 'large')),
  -- Set while a reload is being charged; cleared when it succeeds or fails.
  add column auto_reload_pending_at timestamptz,
  -- Why the last reload failed (e.g. the card was declined). Turning
  -- auto-reload on again clears it.
  add column auto_reload_error text;

-- How a pack was bought: at checkout, or by auto-reload.
alter table public.credit_purchases
  add column source text not null default 'checkout'
    check (source in ('checkout', 'auto_reload'));

create table private.auto_reloads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  pack text not null,
  invoice_id text unique,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed')),
  created_at timestamptz not null default now()
);
create index auto_reloads_workspace_idx on private.auto_reloads (workspace_id, created_at);
alter table private.auto_reloads enable row level security;
revoke all on private.auto_reloads from public, anon, authenticated;

-- Called after credits are spent. Returns the reload to charge (its id and
-- pack), or nothing when no reload is due. The row lock makes two runs
-- finishing together start one reload, not two.
create function public.claim_auto_reload(ws uuid)
returns table (reload_id uuid, pack text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.workspaces%rowtype;
  new_id uuid;
begin
  select * into w from public.workspaces where id = ws for update;
  if not found or not w.auto_reload_enabled or w.credits >= w.auto_reload_threshold then
    return;
  end if;
  -- A reload stuck for over 15 minutes (e.g. a crashed request) no longer blocks.
  if w.auto_reload_pending_at is not null
     and w.auto_reload_pending_at > now() - interval '15 minutes' then
    return;
  end if;
  if (select count(*) from private.auto_reloads r
      where r.workspace_id = ws and r.status <> 'failed'
        and r.created_at >= date_trunc('month', now())) >= 4 then
    return;
  end if;
  update public.workspaces set auto_reload_pending_at = now() where id = ws;
  insert into private.auto_reloads (workspace_id, pack)
    values (ws, w.auto_reload_pack) returning id into new_id;
  reload_id := new_id;
  pack := w.auto_reload_pack;
  return next;
end;
$$;

-- Links the Stripe invoice to its reload, once the invoice exists.
create function public.note_auto_reload_invoice(reload uuid, invoice text)
returns void
language sql
security definer
set search_path = ''
as $$
  update private.auto_reloads set invoice_id = invoice
  where id = reload and invoice_id is null;
$$;

-- A paid reload: adds the pack's credits once, however often Stripe sends
-- the event, and clears the pending mark.
create function public.complete_auto_reload(ws uuid, invoice text, amount integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.credit_purchases (checkout_session_id, workspace_id, credits, source)
  values (invoice, ws, amount, 'auto_reload')
  on conflict (checkout_session_id) do nothing;
  if found then
    update public.workspaces
    set credits = credits + amount,
        plan_baseline = plan_baseline + amount,
        auto_reload_pending_at = null,
        auto_reload_error = null
    where id = ws;
  end if;
  update private.auto_reloads set status = 'paid'
  where invoice_id = invoice and workspace_id = ws;
end;
$$;

-- A failed reload turns auto-reload off and keeps the reason, so the owner
-- sees it on the Billing page instead of being charged again and again.
create function public.fail_auto_reload(ws uuid, reload uuid, reason text)
returns void
language sql
security definer
set search_path = ''
as $$
  update private.auto_reloads set status = 'failed'
  where workspace_id = ws and (id = reload or (reload is null and status = 'pending'));
  update public.workspaces
  set auto_reload_enabled = false,
      auto_reload_pending_at = null,
      auto_reload_error = left(coalesce(reason, 'failed'), 200)
  where id = ws;
$$;

revoke execute on function public.claim_auto_reload(uuid) from public, anon, authenticated;
revoke execute on function public.note_auto_reload_invoice(uuid, text) from public, anon, authenticated;
revoke execute on function public.complete_auto_reload(uuid, text, integer) from public, anon, authenticated;
revoke execute on function public.fail_auto_reload(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.claim_auto_reload(uuid) to service_role;
grant execute on function public.note_auto_reload_invoice(uuid, text) to service_role;
grant execute on function public.complete_auto_reload(uuid, text, integer) to service_role;
grant execute on function public.fail_auto_reload(uuid, uuid, text) to service_role;

-- Credit history: reloads show as their own line.
create or replace function public.credit_activity(ws uuid, max_rows integer default 30)
returns table (
  happened_at timestamptz,
  kind text,          -- image_ads, video_ads, redo, plan, pack, reload, free or adjust
  credits integer,    -- added (positive) or used (negative)
  product text,       -- the product an ad run was for
  status text         -- an ad run's status
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if ws is null or not public.is_workspace_member(ws) then
    raise exception 'Not a member of this workspace' using errcode = '42501';
  end if;
  return query
  select a.happened_at, a.kind, a.credits, a.product, a.status
  from (
    select g.created_at as happened_at,
           case when fr.generation_id is not null then 'redo' else g.type end as kind,
           case when g.status = 'failed' then 0
                else -greatest(0, coalesce(c.amount, g.cost_credits)
                                  - coalesce(r.amount, 0)
                                  - coalesce(fr.credits, 0))
           end::integer as credits,
           p.name as product,
           g.status::text as status
    from public.generations g
    left join private.generation_credit_ledger c
      on c.generation_id = g.id and c.kind = 'charge'
    left join private.generation_credit_ledger r
      on r.generation_id = g.id and r.kind = 'refund'
    left join private.free_redos fr on fr.generation_id = g.id
    left join public.products p on p.id = g.product_id
    where g.workspace_id = ws
    union all
    select pg.created_at, 'plan', pg.credits, null, null
    from public.plan_credit_grants pg
    where pg.workspace_id = ws and pg.credits > 0
    union all
    select cp.created_at, case when cp.source = 'auto_reload' then 'reload' else 'pack' end,
           cp.credits, null, null
    from public.credit_purchases cp
    where cp.workspace_id = ws
    union all
    select ag.created_at, 'adjust', ag.amount, null, null
    from private.admin_credit_grants ag
    where ag.workspace_id = ws and ag.amount <> 0
    union all
    select tc.claimed_at, 'free', 100, null, null
    from private.trial_credit_claims tc
    join public.workspaces w on w.owner_id = tc.user_id
    where w.id = ws
  ) a
  order by a.happened_at desc
  limit least(greatest(coalesce(max_rows, 30), 1), 100);
end;
$$;
