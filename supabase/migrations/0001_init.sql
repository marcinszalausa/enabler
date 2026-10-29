-- Enabler initial schema: multi-tenant workspaces, products, generations, creatives.
-- Every row belongs to a workspace; Row Level Security limits access to members.

create extension if not exists pgcrypto;

-- Workspaces ---------------------------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  plan text not null default 'free',
  credits integer not null default 100 check (credits >= 0),
  created_at timestamptz not null default now()
);

create type public.workspace_role as enum ('owner', 'editor', 'viewer');

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.workspace_role not null default 'editor',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_id_idx on public.workspace_members (user_id);

-- Membership check used by every policy. SECURITY DEFINER avoids recursive
-- RLS evaluation on workspace_members.
create function public.is_workspace_member(ws uuid, min_role public.workspace_role default 'viewer')
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = (select auth.uid())
      and case min_role
            when 'viewer' then true
            when 'editor' then m.role in ('owner', 'editor')
            when 'owner'  then m.role = 'owner'
          end
  );
$$;

-- Products, generations, creatives ----------------------------------------

create table public.products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  url text not null,
  name text,
  description text,
  price text,
  image_urls jsonb not null default '[]'::jsonb,
  brand_brief jsonb,
  created_at timestamptz not null default now()
);

create index products_workspace_id_idx on public.products (workspace_id);

create type public.generation_status as enum ('queued', 'running', 'succeeded', 'failed');

create table public.generations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  type text not null,
  status public.generation_status not null default 'queued',
  prompt text,
  model text,
  cost_credits integer not null default 0,
  cost_usd numeric(10, 4),
  error text,
  created_at timestamptz not null default now()
);

create index generations_workspace_id_idx on public.generations (workspace_id);

create type public.creative_kind as enum ('image', 'video');
create type public.creative_status as enum ('draft', 'approved', 'rejected');

create table public.creatives (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  generation_id uuid not null references public.generations (id) on delete cascade,
  kind public.creative_kind not null,
  aspect text not null,
  storage_path text not null,
  headline text,
  primary_text text,
  cta text,
  status public.creative_status not null default 'draft',
  created_at timestamptz not null default now()
);

create index creatives_workspace_id_idx on public.creatives (workspace_id);
create index creatives_generation_id_idx on public.creatives (generation_id);

-- Row Level Security -------------------------------------------------------

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.products enable row level security;
alter table public.generations enable row level security;
alter table public.creatives enable row level security;

create policy "members read workspace" on public.workspaces
  for select to authenticated using (public.is_workspace_member(id));
create policy "owners update workspace" on public.workspaces
  for update to authenticated using (public.is_workspace_member(id, 'owner'));
-- Plan and credits change only from the server (service role), never the browser.
revoke update on public.workspaces from authenticated;
grant update (name) on public.workspaces to authenticated;

create policy "members read membership" on public.workspace_members
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "owners manage membership" on public.workspace_members
  for all to authenticated
  using (public.is_workspace_member(workspace_id, 'owner'))
  with check (public.is_workspace_member(workspace_id, 'owner'));

create policy "members read products" on public.products
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "editors write products" on public.products
  for all to authenticated
  using (public.is_workspace_member(workspace_id, 'editor'))
  with check (public.is_workspace_member(workspace_id, 'editor'));

-- Generations are created by server jobs; members can only read them.
create policy "members read generations" on public.generations
  for select to authenticated using (public.is_workspace_member(workspace_id));

create policy "members read creatives" on public.creatives
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "editors update creatives" on public.creatives
  for update to authenticated
  using (public.is_workspace_member(workspace_id, 'editor'))
  with check (public.is_workspace_member(workspace_id, 'editor'));

-- New user -> personal workspace -------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws_id uuid;
begin
  insert into public.workspaces (name, owner_id)
  values (coalesce(split_part(new.email, '@', 1), 'My') || '''s workspace', new.id)
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, new.id, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Storage: private bucket, files stored under <workspace_id>/... -----------

insert into storage.buckets (id, name, public)
values ('creatives', 'creatives', false)
on conflict (id) do nothing;

create policy "members read creative files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'creatives'
    and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
  );
