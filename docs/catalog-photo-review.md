# Catalog photo review

Workspace owners on Grow and Scale can open Stores → Check product photos.
The page displays imported photos without cropping, technical photo checks,
and the latest training preparation status for that product.

Checks do not create jobs, grant training allowances, activate models, spend
credits, upload datasets, or contact a paid provider. They inspect at most 30
catalog photos and keep at most 20 distinct suitable photos. Each image must
be at least 768 pixels on both axes. Read failures, small files and potential
duplicates are explained separately. Downloads use the DNS-pinned public
fetcher, with per-image limits, a 36 MiB aggregate download limit, a 32 MiB
normalized-image limit and a 45-second download loop budget.

The same scanner prepares private training datasets. Passing these checks
means only that the technical image gate passed. Product identity, color,
geometry, rights and variation in camera angles still require visual review.
The current pilot requires ten distinct suitable photos; do not duplicate
photos to meet this number.

## Access and freshness

The check endpoint accepts an item ID, never browser-supplied image URLs or
workspace IDs. It requires a verified session, RLS-visible catalog item,
workspace owner role, a qualifying subscription and an enabled connection.
It checks those again after downloading. A source revision change discards
the report. No credential, dataset, model version or normalized image bytes
are returned. Responses are private/no-store. Best-effort per-instance limits
allow two concurrent checks and one check per workspace per minute; these
are compute limits, not a distributed billing guarantee.

## Live pilot prerequisites still outstanding

1. Configure Gooidy's Shopify app and production OAuth/webhook callbacks as
   described in shopify-dashboard-connection.md. Store credentials securely
   in the hosting provider; customers only approve the store connection.
2. Configure and sync the Inngest production app at /api/inngest, with its
   event and signing keys. Follow catalog-training-foundation.md.
3. Connect Soft Mila from the owner dashboard on Grow or Scale, and complete
   a real catalog sync. No manual CSV upload is necessary for Shopify.
4. Open The Cabin Raglan Set, run the photo check, and visually review the
   source photos. Add suitable originals in Shopify and sync again if needed.
5. Configure the private Replicate destination and pinned trainer, agree a
   pilot training budget and provider account spending limits, then allow
   exactly one product training using the existing guarded pilot settings.
   The elapsed-time watchdog is not a hard dollar cap.
6. Review representative sample ads before enabling a compatible inference
   adapter. Model activation and trained-model inference are not implemented
   by this photo-review change. A FLUX LoRA cannot be assumed compatible with
   Wan or LTX video models.

No live account provisioning or paid training is performed by this change.
