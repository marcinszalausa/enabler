#!/usr/bin/env bash
set -euo pipefail
: "${CATALOG_TEST_DATABASE_URL:?Use a disposable database}"
bash scripts/test-premium-stores.sh
psql "$CATALOG_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
create table auth.users(id uuid primary key);
alter table public.workspaces add column credits integer not null default 135;
grant select on public.workspace_members to authenticated;
alter table public.workspace_members enable row level security;
create policy fixture_member_read on public.workspace_members for select to authenticated using(public.is_workspace_member(workspace_id));
SQL
psql "$CATALOG_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261107023806_founder_store_pilot.sql
psql "$CATALOG_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/founder-store-pilot.sql
