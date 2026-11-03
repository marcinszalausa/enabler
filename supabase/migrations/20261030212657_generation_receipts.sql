-- Read-only receipts for a product's workspace members. No ledger access is
-- granted to clients, and this function never changes a balance or run.
create function public.generation_receipts(product uuid)
returns table (generation_id uuid, charged_credits integer, returned_credits integer)
language sql stable security definer set search_path = ''
as $$
  select g.id, charge.amount, refund.amount
  from public.generations g
  left join private.generation_credit_ledger charge
    on charge.generation_id = g.id and charge.kind = 'charge'
  left join private.generation_credit_ledger refund
    on refund.generation_id = g.id and refund.kind = 'refund'
  where g.product_id = product
    and (select auth.uid()) is not null
    and public.is_workspace_member(g.workspace_id);
$$;
revoke all on function public.generation_receipts(uuid) from public, anon, authenticated, service_role;
grant execute on function public.generation_receipts(uuid) to authenticated;
