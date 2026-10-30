#!/usr/bin/env bash
set -euo pipefail
test -n "$CREDIT_TEST_DATABASE_URL"
cd "$(dirname "$0")/.."
db_url="$CREDIT_TEST_DATABASE_URL"
psql "$db_url" -X -v ON_ERROR_STOP=1 -f supabase/tests/generation-recovery.sql
psql "$db_url" -X -v ON_ERROR_STOP=1 -c "insert into auth.users(id,email) values('71000000-0000-0000-0000-000000000001','recovery-race@example.invalid');"
ws="$(psql "$db_url" -XAt -c "select id from public.workspaces where owner_id='71000000-0000-0000-0000-000000000001';")"
product="$(psql "$db_url" -XAtq -c "insert into public.products(workspace_id,url) values('$ws','https://example.invalid') returning id;")"
run="71000000-0000-4000-8000-000000000001"
psql "$db_url" -Xq -v ON_ERROR_STOP=1 -c "select public.reserve_generation('$ws','$run','$product','image_ads','test',10,'{}'); update public.generations set status='running' where id='$run'; update public.generations set started_at=now()-interval '1 hour' where id='$run';"
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT
PGAPPNAME=recovery-output-writer psql "$db_url" -Xq -v ON_ERROR_STOP=1 -c "begin; insert into public.creatives(workspace_id,generation_id,kind,aspect,storage_path) values('$ws','$run','image','1:1','racing-output'); select pg_sleep(3); commit;" >"$out/writer" &
writer=$!
ready=false
for attempt in {1..40}; do
  sleeping="$(psql "$db_url" -XAtq -v ON_ERROR_STOP=1 -c "select count(*) from pg_stat_activity where application_name='recovery-output-writer' and wait_event='PgSleep';")"
  if [[ "$sleeping" == 1 ]]; then ready=true; break; fi
  sleep 0.05
done
[[ "$ready" == true ]] || { echo "Writer did not acquire lock"; exit 1; }
result="$(psql "$db_url" -XAtq -v ON_ERROR_STOP=1 -c "select private.recover_stale_generations();")"
[[ "$result" == 0 ]] || { echo "Sweep did not skip in-flight writer"; exit 1; }
wait "$writer"
pids=""
for i in {1..12}; do
  psql "$db_url" -XAtq -v ON_ERROR_STOP=1 -c "select private.recover_stale_generations();" >"$out/$i" &
  pids="$pids $!"
done
for pid in $pids; do wait "$pid"; done
sum="$(awk '{n+=$1} END {print n+0}' "$out/"[0-9]*)"
balance="$(psql "$db_url" -XAtq -v ON_ERROR_STOP=1 -c "select credits from public.workspaces where id='$ws';")"
refund="$(psql "$db_url" -XAtq -v ON_ERROR_STOP=1 -c "select amount from private.generation_credit_ledger where generation_id='$run' and kind='refund';")"
[[ "$sum" == 1 && "$balance" == 99 && "$refund" == 9 ]] || { echo "Concurrent settlement mismatch: $sum $balance $refund"; exit 1; }
if psql "$db_url" -Xq -v ON_ERROR_STOP=1 -c "insert into public.creatives(workspace_id,generation_id,kind,aspect,storage_path) values('$ws','$run','image','1:1','too-late');" >"$out/late" 2>&1; then
  echo "Late writer bypassed terminal fence"; exit 1
fi
for role_name in anon authenticated service_role; do
  if psql "$db_url" -Xq -v ON_ERROR_STOP=1 -c "set role $role_name; select private.recover_stale_generations();" >"$out/role" 2>&1; then
    echo "Unprivileged recovery call accepted: $role_name"; exit 1
  fi
done
echo "Generation recovery, output fencing, permissions, and concurrency checks passed."
