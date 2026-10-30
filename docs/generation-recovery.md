# Interrupted generation recovery

Images checkpoint each finished output immediately. Image and video settlement
count durable creative rows, including inserts whose responses were lost.

A database trigger stamps started_at on queued -> running. A private sweep runs
every five minutes through pg_cron without requiring an open browser.

- Queued reservations expire after 15 minutes.
- Running images expire 15 minutes after claim.
- Running videos expire two hours after claim.
- Legacy runs without started_at fall back to creation time.

Expired runs keep saved creatives and refund undelivered outputs (10 images or
2 videos per current batch). Empty runs fail with a full refund; fully delivered
runs succeed with zero refund. Unknown pricing and excessive output counts are
skipped for operator review. recovered_at identifies automatically settled jobs.

Recovery locks the generation and uses the existing atomic settlement receipt.
Creative INSERTs lock the same parent and reject late writes after closure.
A unique generation/storage-path index prevents duplicate outputs. Videos use
their job UUID as the creative UUID, and status transitions compare both status
and updated_at so stale pollers cannot overwrite newer workers.

This is bounded cleanup and settlement, not a durable provider execution queue.
It never replays paid requests or publishes posts. Browser polling still collects
video clips before the two-hour deadline. Clips completed only at the provider,
without a saved creative, are refunded at expiry. Interrupted uploads can leave
orphan storage objects; cleanup of those is separate.

## Rollout and verification

Apply the migration before deploying the application. If pg_cron is available,
the migration enables it and installs one recover-stale-generations job at
*/5 * * * *. Vanilla PostgreSQL CI skips scheduling only.

Before merging, verify the production migration in a rollback-only transaction.
At deployment, verify pg_extension, the named active cron.job, and successful
cron.job_run_details. Run security advisors to check function permissions.
To pause recovery, use cron.alter_job(jobid, active := false); retain output
fencing and ledger receipts. No production migration is applied by opening a PR.

PostgreSQL 16/17 tests cover fresh and abandoned jobs; partial, full, and missing
outputs; legacy timestamps; video grace periods; repeat settlement; private RPC
permissions; duplicate, cross-workspace, and late writes; an actual in-flight
output transaction; and overlapping sweeps. Unit tests cover competing video
claims, stale callbacks, reclaimed ownership, and database errors.
