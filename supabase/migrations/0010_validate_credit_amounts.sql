-- Validate at the database boundary, including calls from trusted server code.
-- Keep the existing RPC signatures and atomic conditional UPDATE.
create or replace function public.spend_credits(ws uuid, amount integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if amount is null or amount <= 0 then
    raise exception 'Credit amount must be a positive integer'
      using errcode = '22023';
  end if;

  update public.workspaces
  set credits = credits - amount
  where id = ws and credits >= amount;

  return found;
end;
$$;

create or replace function public.refund_credits(ws uuid, amount integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if amount is null or amount <= 0 then
    raise exception 'Credit amount must be a positive integer'
      using errcode = '22023';
  end if;

  update public.workspaces set credits = credits + amount where id = ws;
end;
$$;

-- Explicitly preserve the service-role-only boundary on both RPCs.
revoke execute on function public.spend_credits(uuid, integer) from public, anon, authenticated;
revoke execute on function public.refund_credits(uuid, integer) from public, anon, authenticated;
grant execute on function public.spend_credits(uuid, integer) to service_role;
grant execute on function public.refund_credits(uuid, integer) to service_role;
