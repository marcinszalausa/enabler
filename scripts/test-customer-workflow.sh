#!/usr/bin/env bash
set -euo pipefail
: "${CREDIT_TEST_DATABASE_URL:?Use an empty disposable database}"
cd "$(dirname "$0")/.."
psql "$CREDIT_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/bootstrap.sql
for file in supabase/migrations/0001_init.sql supabase/migrations/0002_generation.sql supabase/migrations/0003_brand_kit.sql supabase/migrations/20261104011840_customer_workflow.sql; do
 psql "$CREDIT_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$file"
done
# Vanilla PostgreSQL does not have Supabase's default grants.
psql "$CREDIT_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "grant select on public.products,public.brand_kits,public.workspaces to authenticated; grant insert,update on public.brand_kits to authenticated;"
psql "$CREDIT_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/customer-workflow.sql
