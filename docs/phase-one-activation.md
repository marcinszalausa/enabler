# Phase 1: implementation and live acceptance

## Customer workflow

Grow/Scale workspace owners open Stores, connect a configured native platform or
use the CSV template, choose a product, and open its photos. Existing founder
access remains non-expiring and does not grant generation credits.

The product page supports private supplementary photo uploads from a phone,
free size/duplicate checks, selecting 10–20 images, explicit source/rights review,
private dataset preparation, a separate funded training request, three model
sample scenes, and explicit approval/rejection. An approved current FLUX model
can be enabled for image generation and video first frames. Existing technical
and visual quality gates still apply. A model cannot guarantee exact geometry.

CSV accepts the documented six-column contract, up to 250 products/1 MiB. It is
not a parser for every platform's arbitrary export format. CSV stock changes
only on import; signed canonical webhooks supply event-driven updates for custom
stores. Existing native connectors still require their platform registrations
and live installation acceptance before their buttons are enabled.

## Inventory behavior

Shopify's aggregate stock is read with tracking status. A location's zero does
not mean the entire product is sold out. Mixed/untracked or incomplete variant
sets remain unknown rather than causing a false pause. Stock has an independent
timestamp, so an old catalog delivery cannot undo a newer stock observation.
Product deletion/unavailability, inventory events, hourly reconciliation and a
persistent receipt/outbox cover normal updates and missed dispatches. Shopify
app configuration adds the inventory and product-deletion webhook topics without
adding write-product or customer/order scopes.

Out-of-stock transitions queue pause-only actions for product-linked paid ads.
Both adapters check the bound account and confirm the provider's paused state.
Failures remain pending with an error code and durable retries. Restocking does
not enable ads. A dispatch-time guard also blocks sending a known sold-out
product through the existing social publishing path.

**Paid-account connection is a live prerequisite.** The existing Zernio social
connection is not a Meta Marketing/TikTok Ads account. The service-only
catalog_ad_accounts/catalog_ad_bindings tables are populated only after that
connector verifies ownership and binds actual ads to catalog items. No browser
can supply an arbitrary account token/ad ID. Without those verified bindings,
the product page explicitly says paid-ad pausing is not connected. The adapters
are not evidence that account OAuth or app approval has been completed.

Native real-time inventory for other platforms still requires each platform's
webhook registration/acceptance; their periodic catalog refresh is not advertised
as real-time stock protection.

## Training activation

Production Inngest must sync /api/inngest after this release so the new inventory,
pause and sample workers are registered. Catalog storage and its encryption key
remain required. Operator credentials are entered in secure deployment settings,
never in customer forms or chat.

Replicate requires REPLICATE_API_TOKEN, a verified pinned trainer version and a
private destination. Paid execution additionally requires the existing exact
pilot workspace/product allowlist, CATALOG_TRAINING_ENABLED=true, and a genuinely
provider-enforced spending arrangement before CATALOG_PROVIDER_HARD_CAP_CONFIRMED
may be set true. Do not set that flag simply because a prepaid balance or the
application's allowance is $10. Replicate documents possible prepaid overages;
the cancellation watchdog is best effort, not a financial guarantee.

The founder authorized **one test up to $10**. The service-only training limit
stores 1 remaining run and 1000 maximum authorized cents. The database atomically
consumes the allowance before one provider submission; ambiguous responses are
never blindly resubmitted or automatically refunded. Bulk training is disabled.
Photo preparation can run without enabling paid submission once the trainer is
configured. Training requests require the authenticated owner's reviewed source,
current catalog revision and explicit start action. No test in CI calls a paid
provider. No live training run has been performed by this release alone.

Model samples are private, capped at three once-only provider requests. Unknown
submissions need operator reconciliation. Approval requires all three successful
samples and a current source revision. CATALOG_MODEL_INFERENCE_ENABLED remains
off until the first model passes live acceptance and its compute pricing is
approved. A FLUX LoRA is not a Wan/LTX video LoRA; video uses a reviewed product
first frame and the existing image-to-video pipeline.

## Live acceptance still required

1. Verify the Shopify app publish succeeded and new Inngest workers synced.
2. Supply at least ten suitable originals for one Soft Mila product. Current
   catalog products have only one or two imported photos each.
3. Complete Replicate/private-destination setup and spending controls; prepare
   the dataset, run the one authorized test, inspect all three samples, approve
   only if faithful, then verify a generated image/video first frame.
4. Connect authorized paid-ad accounts, bind real test ads, change test inventory,
   and confirm actual platform pauses before claiming paid stock protection live.

Production secrets, merchant app approval, source photos and provider acceptance
cannot be replaced by mocked CI. Phase 1 must not be reported fully complete
until the above live checks pass.
