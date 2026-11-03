#!/usr/bin/env bash
set -euo pipefail
: "${CREDIT_TEST_DATABASE_URL:?Use an empty disposable database}"
cd "$(dirname "$0")/.."
psql "$CREDIT_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/bootstrap.sql
for file in supabase/migrations/0001_init.sql supabase/migrations/0002_generation.sql supabase/migrations/0010_validate_credit_amounts.sql supabase/migrations/20261030143244_generation_credit_ledger.sql; do
 psql "$CREDIT_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$file"
done
psql "$CREDIT_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "insert into auth.users(id,email,email_confirmed_at) values('71000000-0000-4000-8000-000000000001','existing@example.invalid',now()); update public.workspaces set credits=73;"
psql "$CREDIT_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261031145607_trial_campaign_safeguards.sql
psql "$CREDIT_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/trial-campaign.sql
# Concurrent verified signups with the same normalized address get one grant.
output="$(mktemp -d)"
trap 'rm -rf "$output"' EXIT
pids=()
for i in {1..12}; do
 psql "$CREDIT_TEST_DATABASE_URL" -XAtq -v ON_ERROR_STOP=1 -c "insert into auth.users(id,email,email_confirmed_at) values(gen_random_uuid(),'race@example.invalid',now());" >"$output/$i" &
 pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
balance="$(psql "$CREDIT_TEST_DATABASE_URL" -XAt -v ON_ERROR_STOP=1 -c "select sum(credits) from public.workspaces w join auth.users u on u.id=w.owner_id where u.email='race@example.invalid';")"
[[ "$balance" == 100 ]] || { echo "Concurrent signup grants: $balance" >&2; exit 1; }
# Distinct simultaneous free requests may charge exactly one batch.
psql "$CREDIT_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "insert into auth.users(id,email,email_confirmed_at) values('72000000-0000-4000-8000-000000000001','batch-race@example.invalid',now());"
ws="$(psql "$CREDIT_TEST_DATABASE_URL" -XAt -v ON_ERROR_STOP=1 -c "select id from public.workspaces where owner_id='72000000-0000-4000-8000-000000000001';")"
product="$(psql "$CREDIT_TEST_DATABASE_URL" -XAtq -v ON_ERROR_STOP=1 -c "insert into public.products(workspace_id,url) values('$ws','https://example.invalid') returning id;")"
pids=()
for i in {1..12}; do
 (
  if ! psql "$CREDIT_TEST_DATABASE_URL" -XAtq -v ON_ERROR_STOP=1 -c "set role service_role;select public.reserve_generation('$ws',gen_random_uuid(),'$product','image_ads','test',10,'{}');" >"$output/batch-$i" 2>"$output/error-$i"; then
   grep -q 'TRIAL_BATCH_ACTIVE' "$output/error-$i"
  fi
 ) &
 pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
result="$(psql "$CREDIT_TEST_DATABASE_URL" -XAt -v ON_ERROR_STOP=1 -c "select credits||':'||(select count(*) from public.generations where workspace_id='$ws') from public.workspaces where id='$ws';")"
[[ "$result" == "90:1" ]] || { echo "Parallel free requests: $result" >&2; exit 1; }
echo "Trial verification, reset prevention, permissions, limits and concurrency checks passed."
