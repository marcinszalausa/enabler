#!/usr/bin/env bash
set -euo pipefail
: "${CREDIT_TEST_DATABASE_URL:?Use an empty disposable database}"
cd "$(dirname "$0")/.."
psql "$CREDIT_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/bootstrap.sql
psql "$CREDIT_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/migrations/0001_init.sql
psql "$CREDIT_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/migrations/0002_generation.sql
migration=$(find supabase/migrations -name '*_creative_favorites.sql')
psql "$CREDIT_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$migration"
psql "$CREDIT_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/ad-library-fixture.sql
psql "$CREDIT_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/ad-library.sql
echo "Favorite ownership, workspace isolation, viewer access, idempotency, removal and cascade checks passed."
