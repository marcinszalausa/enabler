#!/usr/bin/env bash
set -euo pipefail
: "${CATALOG_TEST_DATABASE_URL:?Use a disposable database}"
psql "$CATALOG_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/catalog-bootstrap.sql
psql "$CATALOG_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261106224914_catalog_training_foundation.sql
psql "$CATALOG_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261106231635_dashboard_shopify_connect.sql
psql "$CATALOG_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/shopify-connect.sql
output="$(mktemp -d)"
trap 'rm -rf "$output"' EXIT
pids=()
for i in {1..20};do
 psql "$CATALOG_TEST_DATABASE_URL" -XAtq -v ON_ERROR_STOP=1 -c "set role service_role;with claimed as(delete from public.shopify_oauth_states where state_hash=repeat('a',64) and expires_at>now() returning state_hash) select count(*) from claimed;" >"$output/$i" &
 pids+=("$!")
done
for pid in "${pids[@]}";do wait "$pid";done
[[ "$(cat "$output/"* | awk '$0=="1"{n++}END{print n+0}')" == 1 ]]
[[ "$(cat "$output/"* | awk '$0=="0"{n++}END{print n+0}')" == 19 ]]
echo "Shopify tenant ownership, credential isolation, reinstall, disconnect and one-use OAuth state passed"
