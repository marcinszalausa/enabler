-- Milestone 1: ad angle on creatives, atomic credit spend/refund.

alter table public.creatives add column angle text;

-- Deducts credits only if the balance covers it. Returns false otherwise.
create function public.spend_credits(ws uuid, amount integer)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with updated as (
    update public.workspaces
    set credits = credits - amount
    where id = ws and credits >= amount
    returning id
  )
  select exists (select 1 from updated);
$$;

create function public.refund_credits(ws uuid, amount integer)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.workspaces set credits = credits + amount where id = ws;
$$;

-- Only the server (service role) may move credits.
revoke execute on function public.spend_credits(uuid, integer) from public, anon, authenticated;
revoke execute on function public.refund_credits(uuid, integer) from public, anon, authenticated;
grant execute on function public.spend_credits(uuid, integer) to service_role;
grant execute on function public.refund_credits(uuid, integer) to service_role;
