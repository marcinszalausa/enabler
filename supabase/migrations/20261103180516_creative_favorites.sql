-- Personal favorites. Visibility always follows current creative/workspace RLS.
create table public.creative_favorites (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  creative_id uuid not null references public.creatives(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, creative_id)
);
create index creative_favorites_creative_idx on public.creative_favorites(creative_id);
alter table public.creative_favorites enable row level security;
revoke all on public.creative_favorites from public, anon, authenticated;
grant select, insert, delete on public.creative_favorites to authenticated;
grant all on public.creative_favorites to service_role;
create policy "read own accessible favorites" on public.creative_favorites
  for select to authenticated
  using (user_id = (select auth.uid()) and exists (
    select 1 from public.creatives c where c.id = creative_id
  ));
create policy "save own accessible favorites" on public.creative_favorites
  for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.creatives c where c.id = creative_id
  ));
create policy "remove own accessible favorites" on public.creative_favorites
  for delete to authenticated
  using (user_id = (select auth.uid()) and exists (
    select 1 from public.creatives c where c.id = creative_id
  ));
-- No UPDATE grant/policy: ownership and creative identity cannot be reassigned.
