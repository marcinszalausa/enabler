#!/usr/bin/env bash
set -euo pipefail
: "${CREDIT_TEST_DATABASE_URL:?Use an empty disposable database}"
cd "$(dirname "$0")/.."
db_url="$CREDIT_TEST_DATABASE_URL"
psql "$db_url" -X -v ON_ERROR_STOP=1 -f supabase/tests/generation-ledger.sql
psql "$db_url" -X -v ON_ERROR_STOP=1 -c "INSERT INTO auth.users(id,email) VALUES('40000000-0000-0000-0000-000000000001','ledger-concurrency@example.invalid');"
ws="$(psql "$db_url" -XAt -v ON_ERROR_STOP=1 -c "SELECT id FROM public.workspaces WHERE owner_id='40000000-0000-0000-0000-000000000001';")"
product="$(psql "$db_url" -XAt -v ON_ERROR_STOP=1 -c "INSERT INTO public.products(workspace_id,url) VALUES('$ws','https://example.invalid') RETURNING id;" | head -n 1)"
request="40000000-0000-4000-8000-000000000001"
output="$(mktemp -d)"
trap 'rm -rf "$output"' EXIT
pids=()
for i in {1..20}; do
  psql "$db_url" -XAtq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT public.reserve_generation('$ws','$request','$product','image_ads','test',10,'{}');" >"$output/$i" &
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
matches="$(cat "$output/"* | awk -v id="$request" '$0 == id {n++} END {print n+0}')"
balance="$(psql "$db_url" -XAt -v ON_ERROR_STOP=1 -c "SELECT credits FROM public.workspaces WHERE id='$ws';")"
[[ "$matches" == 20 && "$balance" == 90 ]] || { echo "Duplicate charge: matches=$matches balance=$balance" >&2; exit 1; }

# Exactly one worker may acquire the queued generation.
pids=()
for i in {1..20}; do
  psql "$db_url" -XAtq -v ON_ERROR_STOP=1 -c "UPDATE public.generations SET status='running' WHERE id='$request' AND status='queued' RETURNING id;" >"$output/$i" &
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
matches="$(cat "$output/"* | awk -v id="$request" '$0 == id {n++} END {print n+0}')"
[[ "$matches" == 1 ]] || { echo "Multiple workers claimed run: $matches" >&2; exit 1; }

pids=()
for i in {1..20}; do
  psql "$db_url" -XAtq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT public.finalize_generation('$request','failed',10,'failed',null);" >"$output/$i" &
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
matches="$(cat "$output/"* | awk '$0 == "t" {n++} END {print n+0}')"
balance="$(psql "$db_url" -XAt -v ON_ERROR_STOP=1 -c "SELECT credits FROM public.workspaces WHERE id='$ws';")"
receipts="$(psql "$db_url" -XAt -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM private.generation_credit_ledger WHERE generation_id='$request';")"
[[ "$matches" == 1 && "$balance" == 100 && "$receipts" == 2 ]] || { echo "Duplicate refund: matches=$matches balance=$balance receipts=$receipts" >&2; exit 1; }

# Distinct requests still compete for the same finite balance.
pids=()
for i in {1..20}; do
  psql "$db_url" -XAtq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT public.reserve_generation('$ws',gen_random_uuid(),'$product','image_ads','test',10,'{}');" >"$output/$i" &
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
balance="$(psql "$db_url" -XAt -v ON_ERROR_STOP=1 -c "SELECT credits FROM public.workspaces WHERE id='$ws';")"
charges="$(psql "$db_url" -XAt -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM private.generation_credit_ledger WHERE workspace_id='$ws' AND kind='charge';")"
[[ "$balance" == 0 && "$charges" == 11 ]] || { echo "Concurrent reservations overspent: balance=$balance charges=$charges" >&2; exit 1; }
echo "Generation ledger and concurrency checks passed."
