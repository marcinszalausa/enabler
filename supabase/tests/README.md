# Credit accounting regression tests

Run only against an **empty, disposable PostgreSQL 16 database**:

```sh
CREDIT_TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/credit_tests bash scripts/test-credits.sh
```

The runner creates minimal Auth/Storage fixtures and roles, applies every real
migration in filename order, and tests credit RPC validation, exact-balance
spending, insufficient funds, missing workspaces, overflow, and execution grants.
It then uses independent service-role connections to test concurrent spending
and refunds. It requires Bash and psql. GitHub Actions provisions PostgreSQL 16
for the same command; no production secrets are used.

The fixture is not a full Supabase environment and does not verify tenant RLS,
PostgREST, or authentication behavior. Its schema and roles remain after the run;
discard the test database afterward.

## Deploying the credit validation fix

After review and passing checks, apply
`supabase/migrations/0010_validate_credit_amounts.sql` once using the existing
Supabase migration procedure. Do not edit or rerun historical migration 0002.
The new migration keeps RPC names, arguments, return types and service-role
permissions. Null, zero and negative amounts now raise SQLSTATE 22023 before
any balance update. Positive amounts preserve existing behavior.

This patch does not introduce charge/refund idempotency. That requires a ledger
and stable operation identifiers across generation creation, failure handling,
and retries, with an explicit policy for partial refunds. Concurrent updates are
atomic; repeating an otherwise valid RPC is still a separate operation.

Prefer a forward corrective migration if a deployment issue arises. Reinstating
the old functions would restore the invalid-amount vulnerability; do not use that
as a routine rollback.
