-- The customer's credit wallet: what added and what used credits, newest
-- first, for the Billing page. Members of a workspace can read its history;
-- the ledger itself stays private.
create function public.credit_activity(ws uuid, max_rows integer default 30)
returns table (
  happened_at timestamptz,
  kind text,          -- image_ads, video_ads, redo, plan, pack or free
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
    select tc.claimed_at, 'free', 100, null, null
    from private.trial_credit_claims tc
    join public.workspaces w on w.owner_id = tc.user_id
    where w.id = ws
  ) a
  order by a.happened_at desc
  limit least(greatest(coalesce(max_rows, 30), 1), 100);
end;
$$;

-- Credits used in the last few days (e.g. 30), after returns and free redos.
create function public.credits_used_recently(ws uuid, days integer default 30)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if ws is null or not public.is_workspace_member(ws) then
    raise exception 'Not a member of this workspace' using errcode = '42501';
  end if;
  return coalesce((
    select sum(greatest(0, coalesce(c.amount, g.cost_credits)
                           - coalesce(r.amount, 0)
                           - coalesce(fr.credits, 0)))
    from public.generations g
    left join private.generation_credit_ledger c
      on c.generation_id = g.id and c.kind = 'charge'
    left join private.generation_credit_ledger r
      on r.generation_id = g.id and r.kind = 'refund'
    left join private.free_redos fr on fr.generation_id = g.id
    where g.workspace_id = ws and g.created_at >= now() - make_interval(days => greatest(coalesce(days, 30), 1)) and g.status <> 'failed'
  ), 0)::integer;
end;
$$;

revoke execute on function public.credit_activity(uuid, integer) from public, anon;
revoke execute on function public.credits_used_recently(uuid, integer) from public, anon;
grant execute on function public.credit_activity(uuid, integer) to authenticated, service_role;
grant execute on function public.credits_used_recently(uuid, integer) to authenticated, service_role;
