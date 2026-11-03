#!/usr/bin/env bash
set -euo pipefail
: "${CREDIT_TEST_DATABASE_URL:?Use a disposable test database}"
cd "$(dirname "$0")/.."
db_url="$CREDIT_TEST_DATABASE_URL"
psql "$db_url" -X -v ON_ERROR_STOP=1 -f supabase/tests/social-connect-state.sql
psql "$db_url" -X -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users(id,email) values('92000000-0000-0000-0000-000000000001','oauth-concurrency@example.invalid');
insert into public.social_profiles(workspace_id,zernio_profile_id)
  select id,'oauth-concurrency-profile' from public.workspaces where owner_id='92000000-0000-0000-0000-000000000001';
select public.register_social_connect_state(repeat('a',64),'92000000-0000-0000-0000-000000000001',
  (select id from public.workspaces where owner_id='92000000-0000-0000-0000-000000000001'),
  'oauth-concurrency-profile','instagram');
SQL
output="$(mktemp -d)"
trap 'rm -rf "$output"' EXIT
pids=()
for i in {1..20}; do
  psql "$db_url" -XAtq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT workspace_id FROM public.consume_social_connect_state(repeat('a',64),'92000000-0000-0000-0000-000000000001');" >"$output/$i" &
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
consumed="$(cat "$output/"* | awk 'length($0)==36 {n++} END {print n+0}')"
remaining="$(psql "$db_url" -XAt -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM private.social_connect_states WHERE user_id='92000000-0000-0000-0000-000000000001';")"
[[ "$consumed" == 1 && "$remaining" == 0 ]] || {
  echo "Replay protection failed: consumed=$consumed remaining=$remaining" >&2
  exit 1
}
echo "OAuth state validation and concurrent replay checks passed."
