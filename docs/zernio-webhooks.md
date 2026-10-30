# Zernio webhook processing

## Contract
Based on the current provider documentation:
- https://docs.zernio.com/webhooks
- https://docs.zernio.com/webhooks/posts
- https://docs.zernio.com/webhooks/accounts

The handler verifies the lowercase hex HMAC-SHA256 against raw request bytes
before parsing JSON. It supports the documented X-Late-Signature legacy alias.
It requires the signed payload's UUID id, event and timestamp. If an event-ID
header is supplied, it must match the signed body; headers cannot replace it.
A streamed 1 MiB body limit applies even when Content-Length is absent or false.

Supported events are post.scheduled, post.published, post.partial, post.failed,
post.cancelled, post.platform.published, post.platform.failed,
post.platform.deleted, post.tiktok.url_resolved, and account.disconnected.
Post updates use the overall post.status snapshot, including on per-platform
events. Only fields consumed by the application are validated; extra provider
fields can evolve. Top-level test:true and webhook.test never mutate data.
Unsubscribed event families, native/external posts and recycled clones are
acknowledged and ignored because they do not represent local published records.

## Transactions and retries
The service-role RPC inserts a private event receipt and applies its side effect
in one transaction. A unique signed event ID serializes concurrent deliveries.
An identical retry returns success without repeating the update/deletion.
Reusing an event ID with a different body hash fails. Raw bodies are not stored.

Database errors and missing local post linkage return HTTP 503, so a webhook
that races creation can retry instead of being lost. A failed transaction leaves
no receipt. An uncertain response can be retried safely even if the first
transaction committed. Reporting includes event ID, event type and a bounded
database error code, without payloads, secrets or database error messages.

Post snapshots older than the last applied webhook timestamp cannot overwrite
newer webhook state. At equal timestamps, an interim snapshot cannot replace
a terminal snapshot. This ordering applies to webhook writes; polling and
createPost response writes remain independent and are not fully ordered here.

Account deletion also requires its signed profile ID to match the account's
local workspace profile. Previously processed disconnect replays cannot delete
a reconnected account. A never-processed old disconnect can still arrive after
a reconnect using the same account ID; lifecycle reconciliation is separate work.

## Operations and rollout
Apply 20261030150431_zernio_webhook_receipts.sql before deploying the app.
It is additive; older app versions continue to operate during the rollout.
Deploy the reviewed PR, then send a webhook.test through Zernio's dashboard
and inspect delivery results. No provider configuration is changed by this PR.

Zernio expects a 2xx within 5 seconds. The handler uses one database round trip,
a 3.5-second RPC abort signal and a 1.5-second database lock timeout. Network and
platform delays can still exceed that budget; returning no acknowledgement is
safe because the next delivery deduplicates against the committed receipt.

Do not enforce a short timestamp freshness window: Zernio retains the original
signed timestamp over its retry ladder (about 51 hours) and manual redelivery.
Keep receipts for as long as replays must be suppressed. No automatic pruning
or durable queue is introduced here. Monitor unmatched local posts: genuinely
untracked supported events will retry and eventually require review in Zernio's
dead-letter logs. Scope production subscriptions to Gooidy's profiles.

Verification runs HTTP-handler tests and SQL transaction/concurrency tests on
PostgreSQL 16 and 17. Test fixtures require disposable databases only and must
never run against production.
