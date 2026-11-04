-- Credit history also lists credits that Gooidy staff added or removed
-- (admin dashboard, private.admin_credit_grants). The staff note stays private.
create or replace function public.credit_activity(ws uuid, max_rows integer default 30)
returns table (
  happened_at timestamptz,
  kind text,          -- image_ads, video_ads, redo, plan, pack, free or adjust
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
    -- Ad runs: the charge, less what was returned and any free redo.
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
    select cp.created_at, 'pack', cp.credits, null, null
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
