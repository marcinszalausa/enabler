#!/usr/bin/env bash
set -euo pipefail
: "${CREDIT_TEST_DATABASE_URL:?Use a disposable test database}"
cd "$(dirname "$0")/.."
db_url="$CREDIT_TEST_DATABASE_URL"
psql "$db_url" -X -v ON_ERROR_STOP=1 -f supabase/tests/zernio-webhook.sql
psql "$db_url" -X -v ON_ERROR_STOP=1 <<'SQL'
insert into auth.users(id,email) values('70000000-0000-0000-0000-000000000001','webhook-concurrency@example.invalid');
insert into public.posts(workspace_id,zernio_post_id,account_ids)
  select id,'concurrency-post','{}' from public.workspaces where owner_id='70000000-0000-0000-0000-000000000001';
create table public.webhook_test_audit(id bigint generated always as identity);
create function public.audit_webhook_test() returns trigger language plpgsql as $$
begin
  if new.zernio_post_id='concurrency-post' then
    insert into public.webhook_test_audit default values;
  end if;
  return new;
end;
$$;
create trigger audit_webhook_test after update on public.posts for each row execute function public.audit_webhook_test();
SQL
output="$(mktemp -d)"
trap 'rm -rf "$output"' EXIT
pids=()
for i in {1..20}; do
  psql "$db_url" -XAtq -v ON_ERROR_STOP=1 -c "SET ROLE service_role; SELECT public.apply_zernio_webhook('70000000-0000-4000-8000-000000000001',repeat('a',64),'post.published','2026-10-30T15:00:00Z','concurrency-post','published','[]',null);" >"$output/$i" &
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
applied="$(cat "$output/"* | awk '$0 == "t" {n++} END {print n+0}')"
duplicates="$(cat "$output/"* | awk '$0 == "f" {n++} END {print n+0}')"
updates="$(psql "$db_url" -XAt -v ON_ERROR_STOP=1 -c 'SELECT count(*) FROM public.webhook_test_audit;')"
[[ "$applied" == 1 && "$duplicates" == 19 && "$updates" == 1 ]] || {
  echo "Duplicate processing: applied=$applied duplicates=$duplicates updates=$updates" >&2
  exit 1
}
echo "Webhook transaction and 20-connection concurrency checks passed."
