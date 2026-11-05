-- Photos an owner uploads for a product, to start ads from. Additive only.
-- Files live in the private "creatives" bucket under
-- <workspace_id>/uploads/<product_id>/<id>.jpg and are written by the server.
create table if not exists public.media_uploads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null unique,
  width integer,
  height integer,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists media_uploads_product_idx on public.media_uploads(product_id, created_at desc);
create index if not exists media_uploads_workspace_idx on public.media_uploads(workspace_id);
alter table public.media_uploads enable row level security;
revoke all on public.media_uploads from public, anon, authenticated;
grant select on public.media_uploads to authenticated;
grant all on public.media_uploads to service_role;
create policy "members read media uploads" on public.media_uploads
  for select to authenticated
  using (public.is_workspace_member(workspace_id));
