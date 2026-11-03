#!/usr/bin/env bash
set -euo pipefail
: "${CREDIT_TEST_DATABASE_URL:?Set CREDIT_TEST_DATABASE_URL to an empty disposable PostgreSQL database}"
cd "$(dirname "$0")/.."
db_url="$CREDIT_TEST_DATABASE_URL"
psql "$db_url" -X -v ON_ERROR_STOP=1 -f supabase/tests/bootstrap.sql
for migration in supabase/migrations/*.sql; do
  psql "$db_url" -X -v ON_ERROR_STOP=1 -f "$migration"
done
# Legacy accounting suites exercise paid concurrency. Free limits and unverified
# signups are exercised separately in test-trial-campaign.sh.
psql "$db_url" -X -v ON_ERROR_STOP=1 -c "alter table public.workspaces alter column plan set default 'starter';"
psql "$db_url" -X -v ON_ERROR_STOP=1 -f supabase/tests/credits.sql

# An actual unprivileged call must fail, not just return an unchanged balance.
for role_name in anon authenticated credit_unprivileged; do
  for rpc in spend_credits refund_credits; do
    if psql "$db_url" -X -v ON_ERROR_STOP=1 -c "SET ROLE $role_name; SELECT public.$rpc('ffffffff-ffff-ffff-ffff-ffffffffffff', 1);" >/dev/null 2>&1; then
      echo "ERROR: $role_name executed $rpc" >&2
      exit 1
    fi
  done
done

# Twenty independent database connections compete for ten affordable spends.
# Exercise the service-role RPC rather than directly updating the balance.
psql "$db_url" -X -v ON_ERROR_STOP=1 -c "INSERT INTO auth.users (id, email) VALUES ('20000000-0000-0000-0000-000000000002', 'credit-concurrency@example.invalid');"
workspace_id="$(psql "$db_url" -XAt -v ON_ERROR_STOP=1 -c "SELECT id FROM public.workspaces WHERE owner_id = '20000000-0000-0000-0000-000000000002';")"
test_output="$(mktemp -d)"
trap 'rm -rf "$test_output"' EXIT
pids=()
for i in {1..20}; do
  psql "$db_url" -XAtq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT public.spend_credits('$workspace_id', 10);" >"$test_output/$i" &
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
successes="$(cat "$test_output/"* | awk '$0 == "t" {n++} END {print n+0}')"
failures="$(cat "$test_output/"* | awk '$0 == "f" {n++} END {print n+0}')"
balance="$(psql "$db_url" -XAt -v ON_ERROR_STOP=1 -c "SELECT credits FROM public.workspaces WHERE id = '$workspace_id';")"
[[ "$successes" == 10 && "$failures" == 10 && "$balance" == 0 ]] || {
  echo "Concurrent spend failed: successes=$successes failures=$failures balance=$balance" >&2
  exit 1
}

pids=()
for i in {1..20}; do
  psql "$db_url" -Xq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT public.refund_credits('$workspace_id', 1);" >/dev/null &
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
balance="$(psql "$db_url" -XAt -v ON_ERROR_STOP=1 -c "SELECT credits FROM public.workspaces WHERE id = '$workspace_id';")"
[[ "$balance" == 20 ]] || { echo "Concurrent refunds lost updates: $balance" >&2; exit 1; }
echo "Credit validation, permissions, and concurrency checks passed."
