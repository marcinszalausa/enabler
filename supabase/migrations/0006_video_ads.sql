-- Video ads: each clip is a long-running job at the video model, tracked here
-- until its finished video is saved as a creative. Only the server writes.

create table public.video_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  generation_id uuid not null references public.generations (id) on delete cascade,
  -- drafting: making the first frame; pending: the video model is working;
  -- processing: adding text and saving; then done or failed.
  status text not null default 'drafting'
    check (status in ('drafting', 'pending', 'processing', 'done', 'failed')),
  request_id text,
  angle text,
  headline text,
  primary_text text,
  cta text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index video_jobs_generation_id_idx on public.video_jobs (generation_id);
create index video_jobs_workspace_id_idx on public.video_jobs (workspace_id);

alter table public.video_jobs enable row level security;

create policy "members read video jobs" on public.video_jobs
  for select to authenticated using (public.is_workspace_member(workspace_id));
