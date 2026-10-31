# Trial campaign
The starter allowance remains 100 credits, once, with no expiry or automatic refill.
Images are the default for free-workspace controls; explicitly chosen video setup
still opens video. A complete image batch costs 10 credits for 10 images. The
capacity display rounds down to complete batches. Video shows selected cost and
remaining balance; unaffordable video batches cannot submit from the form. The
server remains authoritative for charging.

The product page guides creation, choosing a favorite and connecting/posting.
Progress uses actual saved creatives and published post states; it does not claim
a favorite was selected before a publication. Plan comparison appears only after
ads exist. It links to the existing pricing section; this is not paid checkout.
Advertising spend is separate. No actual ads, emails or provider jobs run in tests.

## Security and rollout
Apply supabase/migrations/20261031145607_trial_campaign_safeguards.sql before merging the application.
It is transactional, locks signup writes during backfill, preserves existing
balances, and records existing users as already having received their allowance.
Future workspaces start at zero. Internal trigger-only helpers grant 100 credits
only after email verification (including already-verified OAuth inserts).
Private SHA-256 hashes of normalized emails and claimed user UUIDs prevent a
second grant for the same email or funded user. The claims have no cascading
user foreign key and survive account deletion. They are anti-abuse records, not
public analytics; roles including service_role have no direct table access.
Retention and removal requests require an explicit administrative decision:
deleting a claim restores eligibility. No device fingerprint, IP block or
email alias/domain normalization is used.

Free workspaces may have one queued/running batch and start ten batches in a
rolling hour. Workspace locking makes concurrent reservations safe. Existing
request retries return before these limits, and blocked requests do not charge.
Failed/refunded attempts count toward the hourly limit. Paid plan concurrency
and refund accounting are unchanged. Automatic recovery still settles abandoned
generations. The UI maps the two stable limit error messages to localized copy.

This reduces replay and burst abuse; it is not proof of a unique human. Multiple
different verified emails, distributed signups and Gmail aliases remain possible.
CAPTCHA/risk screening and account-level signup limits need separate configuration.
Product import rate limits are not added here.

## Verification
Disposable PostgreSQL 16/17 tests exercise verification, confirmation replay,
extra workspaces, account deletion/recreation, email changes, preserved balances,
hidden grants, idempotency, refunds, hourly and concurrent limits, paid behavior,
concurrent same-email signups and distinct concurrent generation requests.
Legacy accounting fixtures default to verified paid users, so their finite-balance
concurrency tests remain valid. Free limits use their own actual free fixtures.

Browser fixtures verify image defaults, explicit video choices, selected video
cost and resulting balance, unaffordable batches, complete-batch capacity,
post-value plan links, mobile, dark mode and Arabic. No real accounts are created.

## Measuring value
Use existing records to measure verified owner accounts with saved creatives,
published posts, and generations on multiple dates. Do not treat a queued post as
published, a download link as a download event, or workspaces.plan as a confirmed
payment. Signup-to-paid conversion requires a real billing integration; there is
no payment confirmation source in this change. Current records can establish a
baseline for activation and repeat creation, not prove a conversion improvement.
