#!/usr/bin/env bash
set -euo pipefail
: "${CATALOG_TEST_DATABASE_URL:?Disposable test database required}"
psql "$CATALOG_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/catalog-bootstrap.sql
psql "$CATALOG_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261106224914_catalog_training_foundation.sql
psql "$CATALOG_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261106231635_dashboard_shopify_connect.sql
psql "$CATALOG_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
create function public.can_connect_store(ws uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.workspaces where id=ws)$$;
create table public.platform_stores(id uuid primary key default gen_random_uuid(),connection_id uuid not null);
grant all on public.platform_stores to service_role;
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
insert into public.catalog_ad_connect_intents(id,workspace_id,user_id,provider,state_hash,nonce_hash,status,expires_at,credentials_cipher)
values('80000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','meta',repeat('a',64),repeat('b',64),'authorized',now()+interval '5 minutes','encrypted fixture');
do $$ begin
 begin perform public.finalize_catalog_ad_account('80000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',repeat('c',64),'11','Account','encrypted token',null);raise exception 'foreign nonce accepted';exception when others then if sqlerrm<>'PAID_CONNECT_STATE_INVALID' then raise;end if;end;
 perform public.finalize_catalog_ad_account('80000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',repeat('b',64),'11','Account','encrypted token',null);
 begin perform public.finalize_catalog_ad_account('80000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',repeat('b',64),'11','Account','other token',null);raise exception 'receipt replay accepted';exception when others then if sqlerrm<>'PAID_CONNECT_STATE_INVALID' then raise;end if;end;
 if exists(select 1 from public.catalog_ad_connect_intents where status='consumed' and credentials_cipher is not null) then raise exception 'consumed receipt kept token';end if;
 if has_table_privilege('authenticated','public.catalog_ad_connect_intents','SELECT') then raise exception 'OAuth receipts exposed';end if;
 if has_function_privilege('authenticated','public.bind_catalog_paid_ad(uuid,uuid,text,uuid,text)','EXECUTE') then raise exception 'binding RPC exposed';end if;
 begin perform public.bind_catalog_paid_ad('40000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','22','20000000-0000-4000-8000-000000000002','active');raise exception 'viewer bound an ad';exception when others then if sqlerrm<>'PAID_AD_ACCESS_DENIED' then raise;end if;end;
end $$;
do $$ declare a uuid;b uuid;begin
 a:=public.ensure_csv_catalog_connection('10000000-0000-4000-8000-000000000001','https://csv.example','encrypted');
 b:=public.ensure_csv_catalog_connection('10000000-0000-4000-8000-000000000001','https://csv.example','new encrypted');
 if a<>b then raise exception 'CSV retry created duplicate sources';end if;
end $$;
SQL
echo 'Phase 1 stock transitions, private photo RLS, funded 20-way training claim and model approval gates passed'
