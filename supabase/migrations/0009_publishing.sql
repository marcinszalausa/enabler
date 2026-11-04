-- Publishing: connected social accounts, a weekly posting schedule and the
-- posts Gooidy sent (or will send) to them. Accounts are connected and posts
-- delivered through Zernio, which holds the platforms' tokens; we keep only
-- its ids. Only the server writes; members read.

-- One Zernio profile per workspace groups that workspace's accounts.
create table public.social_profiles (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  zernio_profile_id text not null unique,
  created_at timestamptz not null default now()
);

create table public.social_accounts (
  id text primary key, -- Zernio's account id
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  platform text not null,
  username text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create index social_accounts_workspace_id_idx on public.social_accounts (workspace_id);

-- "Add to queue" and Autopilot use these weekly slots, e.g.
-- [{"day": 1, "time": "10:00"}] is Mondays at 10:00 in time_zone.
create table public.publishing_schedules (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  time_zone text not null default 'UTC',
  slots jsonb not null default '[]'::jsonb,
  -- Queue every finished run's ads to these accounts without a click.
  autopilot boolean not null default false,
  autopilot_accounts text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  creative_id uuid references public.creatives (id) on delete set null,
  zernio_post_id text unique,
  caption text,
  account_ids text[] not null,
  -- null: published right away.
  scheduled_for timestamptz,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'publishing', 'published', 'partial', 'failed', 'cancelled')),
  -- Per platform: [{"platform", "account_id", "status", "url", "error"}].
  results jsonb not null default '[]'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index posts_workspace_id_idx on public.posts (workspace_id, created_at desc);
create index posts_creative_id_idx on public.posts (creative_id);

alter table public.social_profiles enable row level security;
alter table public.social_accounts enable row level security;
alter table public.publishing_schedules enable row level security;
alter table public.posts enable row level security;

create policy "members read social accounts" on public.social_accounts
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members read publishing schedule" on public.publishing_schedules
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members read posts" on public.posts
  for select to authenticated using (public.is_workspace_member(workspace_id));
