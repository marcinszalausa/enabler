# Choose and post
Completed batches show a full uncropped preview, selectable thumbnails, chosen
copy, a primary Post this ad action, and a secondary original download. Active
batches keep their incremental grid and generation/refund status. Batch
publishing remains under More options. Viewers can preview and download; only
editors see publishing controls. Existing server authorization is unchanged.

Post this ad reviews exactly one creative, caption, targets and timing. One ad
defaults to Now; batch publishing keeps the previous queue default. Explicit
submission is required. Provider acceptance links to actual post status and
does not fabricate a Published state. Successful forms cannot submit again
until the customer closes and opens a new explicit review.

The choice is a 24-hour, tab-local sessionStorage hint of validated UUIDs,
scoped to the workspace. It survives account connection in the same tab and
gives a Back to my ad link on Publishing. The gallery validates the query
against actual visible creatives, restoring a preview without automatic posting.
Storage failures do not block viewing. No OAuth state, RLS, credit or schema
changes. Image previews use bounded thumbnails; original downloads stay intact.

Pure tests cover expiry, workspace isolation, safe paths and blocked storage.
Browser tests cover mobile/desktop/Arabic, modal focus/Escape, exact selected
payloads, mocked failure/retry/success and duplicate-submit disabling. The test
temporarily replaces the publishing server action with a local stub and restores
it in finally. It sends no real posts, messages, accounts or provider requests.
Full existing regressions run on the pull request. Billing is separate; the
older Stripe draft is not merged by this change.

Until paid checkout is activated, existing Publishing upgrade links lead to the
real plan comparison instead of the absent /dashboard/billing route.
