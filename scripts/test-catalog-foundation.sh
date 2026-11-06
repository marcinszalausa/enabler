#!/usr/bin/env bash
set -euo pipefail
: "${CATALOG_TEST_DATABASE_URL:?Use a disposable test database}"
psql "$CATALOG_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/catalog-bootstrap.sql
psql "$CATALOG_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261106214956_catalog_training_foundation.sql
psql "$CATALOG_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/catalog-foundation.sql
output="$(mktemp -d)"
trap 'rm -rf "$output"' EXIT
pids=()
for i in {1..20}; do
 psql "$CATALOG_TEST_DATABASE_URL" -XAtq -v ON_ERROR_STOP=1 -c "set role service_role;select public.claim_catalog_training('50000000-0000-4000-8000-000000000001');" >"$output/$i" &
 pids+=("$!")
done
for pid in "${pids[@]}";do wait "$pid";done
[[ "$(cat "$output/"* | awk '$0=="t"{n++}END{print n+0}')" == 1 ]]
[[ "$(cat "$output/"* | awk '$0=="f"{n++}END{print n+0}')" == 19 ]]
psql "$CATALOG_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
update public.catalog_training_jobs set status='failed';
insert into public.catalog_training_jobs(workspace_id,item_id,image_revision,trainer_version,destination,status)
select workspace_id,item_id,repeat('b',64),trainer_version,destination,'dataset_ready' from public.catalog_training_jobs;
do $$ begin if (select training_allowance from public.catalog_connections)<>0 then raise exception 'allowance not consumed';end if;
if exists(select 1 from public.catalog_training_jobs where status='dataset_ready' and public.claim_catalog_training(id)) then raise exception 'allowance refilled';end if;end $$;
SQL
echo "Catalog RLS, stale events, tenant constraints and 20-way paid claim checks passed"
