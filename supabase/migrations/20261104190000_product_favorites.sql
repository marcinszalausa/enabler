-- Personal product favorites, like creative_favorites. Additive only.
create table if not exists public.product_favorites (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index if not exists product_favorites_product_idx on public.product_favorites(product_id);
alter table public.product_favorites enable row level security;
revoke all on public.product_favorites from public, anon, authenticated;
grant select, insert, delete on public.product_favorites to authenticated;
grant all on public.product_favorites to service_role;
create policy "read own accessible product favorites" on public.product_favorites
  for select to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from public.products p where p.id = product_id));
create policy "save own accessible product favorites" on public.product_favorites
  for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.products p where p.id = product_id));
create policy "remove own accessible product favorites" on public.product_favorites
  for delete to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from public.products p where p.id = product_id));
