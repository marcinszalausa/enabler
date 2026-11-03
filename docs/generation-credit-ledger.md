# Generation credit ledger

## Behavior
The submitted request UUID is the generation UUID and charge operation ID.
The server calculates prices and checks the authenticated user's product access
before calling the service-role RPC. reserve_generation atomically inserts the
queued generation, debits credits, and writes one private ledger receipt.
Repeating an ID with the same workspace and inputs returns the existing run;
different inputs are rejected. Insufficient funds leave no run or ledger entry.

Image and video workers must claim queued -> running before contacting providers.
finalize_generation locks the generation and atomically records the final state,
refund (including a zero-refund receipt), and balance update. The first terminal
outcome wins. Partial failures refund only undelivered output, up to the charge.
A failed refund rolls back the terminal state so settlement can be retried.

The browser keeps IDs stable across retries of unchanged form data and queued
double-clicks. An acknowledged success rotates the form ID for the next intended
run. Editing options after an error or remounting/reloading the form starts a new
request. This does not promise deduplication across browser reloads or sessions.

## Rollout
1. Review this PR and require application and PostgreSQL 16/17 checks to pass.
2. Apply 20261030143244_generation_credit_ledger.sql to production before
   deploying the new application. It is additive and leaves existing RPCs intact.
3. Deploy the application, then let old requests/workers drain. New image/video
   paths no longer call the legacy amount-only spend/refund RPCs.
4. Review queued/running generations with operational monitoring. Long-running
   job recovery and durable execution remain separate work; a claimed worker
   that crashes is not restarted automatically by this change.

Do not remove the legacy RPCs during the rolling deployment. Old deployments
can still use them without idempotency, and historical charges are not fabricated
in the ledger. A legacy video run settled by new code gets a refund receipt but
no historical charge entry. Reconcile any historically ambiguous refunds before
retiring legacy functions. The private ledger tracks new operations rather than
claiming to be a complete historical account statement.

If deployment fails, roll back the application while leaving the additive schema
in place. Older code retains its previous behavior. Never run the test bootstrap
or test fixtures against production.

## Verification
GitHub Actions installs the locked application dependencies and runs request-ID
and settlement-helper tests, route type generation, TypeScript and changed-file
lint checks. PostgreSQL 16 and 17 suites apply all migrations, test repeated and
conflicting operations, workspace boundaries, insufficient funds and refund
rollback, and use 20 concurrent connections to test charges, worker claims,
refunds, and finite balances. Vercel provides the application preview build.

A complete end-to-end run against paid providers and full browser interaction
tests are not part of this suite. Autopilot publishing remains separate from the
financial transaction and does not have durable retry guarantees in this patch.
