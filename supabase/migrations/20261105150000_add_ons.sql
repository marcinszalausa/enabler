-- Paid add-ons, phase 1: what a workspace has unlocked, and what each run asked for.

-- Plan unlocks. Only the service role changes them: authenticated users may
-- update nothing on workspaces but "name" (0001_init.sql column grant).
alter table public.workspaces
  add column if not exists priority_queue boolean not null default false,
  -- Autopilot stays on for everyone who has it today; a plan can switch it off later.
  add column if not exists auto_publish boolean not null default true;

comment on column public.workspaces.priority_queue is
  'Every image run gets Priority (more images made at once) at no extra credits.';
comment on column public.workspaces.auto_publish is
  'Autopilot may post finished runs. When false, runs are never auto-published.';

-- A run's add-ons live in request_options.add_ons, so reserve_generation's
-- idempotency check (same request id, same options) already covers them.
-- These read-only columns expose them for reporting and queue ordering.
alter table public.generations
  add column if not exists add_ons jsonb
    generated always as (
      case when jsonb_typeof(request_options->'add_ons') = 'object'
        then request_options->'add_ons' else '{}'::jsonb end
    ) stored,
  add column if not exists priority smallint
    generated always as (
      case when request_options->'add_ons'->>'priority' = 'true' then 100 else 0 end
    ) stored;

comment on column public.generations.add_ons is
  'Add-ons this run asked for, e.g. {"priority": true}; later {"upscale_4k": true, "languages": ["es","fr"]}.';
comment on column public.generations.priority is
  '100 for Priority runs, 0 otherwise.';

create index if not exists generations_open_by_priority
  on public.generations (priority desc, created_at)
  where status in ('queued', 'running');
