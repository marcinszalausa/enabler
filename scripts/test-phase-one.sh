#!/usr/bin/env bash
set -euo pipefail
: "${CATALOG_TEST_DATABASE_URL:?Disposable test database required}"
psql "$CATALOG_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/catalog-bootstrap.sql
psql "$CATALOG_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261106224914_catalog_training_foundation.sql
psql "$CATALOG_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261106231635_dashboard_shopify_connect.sql
psql "$CATALOG_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
create function public.can_connect_store(ws uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.workspaces where id=ws)$$;
create or replace function public.is_workspace_member(ws uuid,min_role public.workspace_role default 'viewer') returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.workspace_members where workspace_id=ws and user_id=auth.uid() and (role='owner' or min_role='viewer' or (role='editor' and min_role='editor')))$$;
SQL
psql "$CATALOG_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261107101211_phase_one_catalog_completion.sql
psql "$CATALOG_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/phase-one.sql
output="$(mktemp -d)"
trap 'rm -rf "$output"' EXIT
pids=()
for i in {1..20}; do
 psql "$CATALOG_TEST_DATABASE_URL" -XAtq -v ON_ERROR_STOP=1 -c "set role service_role;select public.claim_catalog_training('50000000-0000-4000-8000-000000000001');" >"$output/$i" &
 pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
[[ "$(cat "$output/"* | awk '$0=="t"{n++}END{print n+0}')" == 1 ]]
[[ "$(cat "$output/"* | awk '$0=="f"{n++}END{print n+0}')" == 19 ]]
psql "$CATALOG_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin if (select remaining_runs from public.catalog_training_limits)<>0 then raise exception 'training allowance not consumed';end if;end $$;
update public.catalog_training_jobs set status='succeeded',candidate_version='fixture/private:'||repeat('a',64);
do $$ begin if public.review_catalog_model('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','approved') then raise exception 'unreviewed model activated';end if;end $$;
insert into public.catalog_model_samples(workspace_id,job_id,scenario,status,storage_path) select '10000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',n,'succeeded','private/sample-'||n||'.jpg' from generate_series(0,2) n;
do $$ begin if not public.review_catalog_model('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','approved') then raise exception 'reviewed model could not activate';end if;end $$;
SQL
echo 'Phase 1 stock transitions, private photo RLS, funded 20-way training claim and model approval gates passed'
