# Customer campaign workflow

Delivered in sequence: brand memory; coordinated campaign plans and asset bundles; revisions; weekly posting calendar; network results; seasonal starting points.

Brand kit now remembers name, default audience, tone and topics to avoid. Product-specific audience choices take priority. Each reservation snapshots brand preferences and campaign direction; workers read that reserved snapshot. Old runs without these fields retain their previous behavior. Campaign offers replace any older product offer, so expired discounts do not leak into new ads.

Campaigns are immutable plans for one product. A plan coordinates the message across image and video batches. Saving a plan never creates media or posts. Customers explicitly select the medium and quality and see the existing tier price before reserving credits. The campaign view gathers its batches, exports captions and links to posting. Image and video generation remain separate, explicitly priced actions; there is no hidden combined charge or automatic spending.

Editors can change image overlay text and post captions without generation credits. Video captions are editable; baked video narration and overlays require a new video batch. Text edits do not rewrite already queued or published posts. Conflicting edits are rejected. Public showcase ads cannot be edited in place. Private image responses revalidate using an ETag after authorization: unchanged copy/branding returns 304 without decoding or rendering the photo again, and saved edits invalidate the result. Public image caching is unchanged. Scene changes save a new campaign direction and lead to the ordinary, priced generation controls; they currently create a replacement batch, not a single-asset rerender.

The posting calendar shows the latest loaded posts in the saved schedule time zone, or UTC when no schedule exists. Previous/next week and date groups only change the view; posting still requires the existing publish dialog. It does not claim availability beyond the loaded post window.

Results are loaded on explicit request for the latest eight published/partly published workspace posts. The provider ID comes from workspace-filtered RLS data, never a user-supplied query. The read-only Zernio analytics endpoint is bounded by an eight-second timeout. Only synced, matching-post responses are shown. Missing data remains unavailable. Pending and analytics-add-on responses are explicit; no add-on is purchased. Sales attribution, automatic A/B decisions and guaranteed outcomes are not included. Network definitions differ, so no cross-network winner is declared. Source: https://docs.zernio.com/core/analytics .

Seasonal ideas cover upcoming US occasions within 90 days, with no invented offer. They fill editable campaign fields; no email, generation, publishing or spending starts automatically.

Checkout remains disabled pending Stripe/entity configuration. Existing plan prices, tier rates, trial limits, credit reservations/refunds, rendering quality checks and integration limits are unchanged. Tests use disposable data and mocked providers; no live generation or social posting is performed.

Schema is additive: brand_kits.profile and campaigns. Campaigns use member read/editor insert and delete policies, validate the product belongs to the same workspace on insert, and have workspace/date and product indexes. Existing data is preserved. To roll back application code, these unused additive fields can stay in place; do not delete customer campaign data.
