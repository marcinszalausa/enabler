-- Additive only. Existing credits, media, posts and customer preferences stay intact.
alter table public.brand_kits add column profile jsonb not null default '{"name":"","audience":"","tone":"","avoid":""}'::jsonb
  check (jsonb_typeof(profile) = 'object' and octet_length(profile::text) <= 6000);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  goal text not null check (goal in ('introduce','visits','offer')),
  message text not null check (length(message) between 1 and 240),
  offer text not null default '' check (length(offer) <= 240),
  scene text not null default '' check (length(scene) <= 240),
  created_at timestamptz not null default now(),
  check (goal <> 'offer' or length(trim(offer)) > 0)
);
create index campaigns_workspace_created on public.campaigns(workspace_id,created_at desc);
create index campaigns_product on public.campaigns(product_id);
alter table public.campaigns enable row level security;
grant select,insert,update,delete on public.campaigns to authenticated;
grant all on public.campaigns to service_role;
create policy "members read campaigns" on public.campaigns for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy "editors insert campaigns" on public.campaigns for insert to authenticated
  with check (public.is_workspace_member(workspace_id,'editor') and exists (select 1 from public.products p where p.id=product_id and p.workspace_id=campaigns.workspace_id));
-- Immutable plans keep previous runs reproducible; start another campaign to change direction.
create policy "editors delete campaigns" on public.campaigns for delete to authenticated
  using (public.is_workspace_member(workspace_id,'editor'));
