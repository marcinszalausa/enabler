# Catalog → private training pilot

This is the first foundation slice, not the full five-phase autonomous-ad system. It adds signed product-catalog delivery, a canonical CSV contract, a persistent delivery outbox, durable Inngest processing, private dataset preparation and one-product Replicate training. No paid-ad API, autonomous budget scaling, trend harvesting, LoRA video compatibility or automatic charges/top-ups are added by this slice.

## Deployment and provider setup

The installed dependencies are pinned in package.json/package-lock.json. The Inngest app id is gooidy-catalog; its serve endpoint is /api/inngest with 300-second hosting steps and durable waits between status checks. Install the official Inngest Vercel integration, or add production-scoped INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY and sync the deployed endpoint. A code definition is not evidence that an Inngest Cloud app has been provisioned.

Set a random CATALOG_ENCRYPTION_KEY (32 bytes, hex-encoded) securely in Vercel, then CATALOG_INGESTION_ENABLED=true. Create a connection by an authenticated workspace owner using POST /api/catalog/connections with workspaceId, platform (shopify/woocommerce/wix/custom), storeUrl (HTTPS origin), webhookDomain and webhookSecret. Secret values must be supplied through a secure owner/admin channel, never chat, source control, query strings or logs. They are encrypted with AES-256-GCM; authenticated users cannot read the credential table.

For Shopify use a store-specific custom-app client secret and its exact myshopify.com domain. Subscribe only to products/create and products/update for this pilot. WooCommerce uses product.created/product.updated and its configured signing secret. Wix and custom sources require a trusted server bridge that maps to the canonical contract and signs it; native Wix JWT verification is NOT implemented or claimed. OAuth account installation and automatic webhook registration require store-admin credentials and are not provisioned by deploying these endpoints.

## Canonical product snapshot

Custom/Wix bridge requests carry event_id and products. Each product has externalId, url, name, images (up to 30 HTTPS URLs), inventoryQuantity (nonnegative integer or null when unknown), and updatedAt (ISO timestamp with timezone). The product URL must match the registered store origin. The x-gooidy-signature header is t=UNIX_SECONDS,v1=HEX_HMAC_SHA256 over timestamp + "." + raw body, with a five-minute tolerance. Native Shopify/Woo signatures use their documented raw-body HMAC headers. Deliveries are persisted before acknowledgment, deduplicated by connection/event ID, and reject the same ID with a different body hash.

POST /api/catalog/import accepts authenticated owner JSON {workspaceId,connectionId,csv}, with an Idempotency-Key header. CSV headers are external_id,url,name,images,inventory_quantity,updated_at; multiple image URLs use | inside a quoted cell. Unknown inventory is blank. Quoted commas/newlines are supported. Limit: 250 products and 1 MiB CSV text. Arbitrary platform export formats need mapping; they are not silently guessed.

Source snapshots only update older records. Equal timestamps do not override a record; providers with coarse timestamps need authoritative reconciliation. Inventory counts are recorded, including known zero versus unknown. Native per-location inventory webhooks, automatic paid-ad pause, stock reconciliation and a dispatch-time stock guard are NOT implemented in this initial training slice. Existing Zernio social posting is not a paid-ad control integration.

## First paid training

The selected pilot candidate is The Cabin Raglan Set, https://www.softmila.com/products/mens-raglan-lounge-set. Existing Gooidy imports currently contain only one source image per product. Do not manufacture duplicates or train until the full catalog provides sufficient photos.

Set the production-only pilot workspace and exact product URL, REPLICATE_API_TOKEN, a verified pinned fast-flux-trainer version, and a pre-created private destination. Only then set CATALOG_TRAINING_ENABLED=true. A trusted operator must grant training_allowance=1 on the selected catalog connection. The owner-facing API cannot grant this allowance. It is atomically consumed at submission and is never automatically refunded; another run requires deliberate replenishment. The database also allows at most one submission per workspace in a rolling 24 hours, including ambiguous/failed submissions.

The worker requires at least 10 distinct photos (up to 20), at least 768 pixels on both axes. It rejects duplicates and very similar thumbnails, bounds download time/bytes/pixels, strips metadata, normalizes images and stores a private ZIP. Source images are downloaded through the existing DNS-pinned SSRF-safe fetcher. This is a technical dataset gate, not proof of varied angles, rights or correct product identity; source suitability still needs review.

The training uses 1,000 steps and lora_type=subject. Provider pricing is per compute second and may change. A ten-minute elapsed-time cancellation watchdog is best-effort, not a hard dollar cap: scheduling delays or unconfirmed provider cancellation can incur additional charges. Set account-level spend/prepaid limits as well. No test in CI calls a paid provider. No training has been launched merely by committing this code.

Replicate training creation has no documented idempotency guarantee. A lost response is marked submission_unknown. The worker never blindly re-POSTs. Reconciliation scans the latest provider trainings for the unique trigger and pinned trainer version. If not found or ambiguous, operator reconciliation is required; no replacement job is charged automatically. Cancellation remains pending until a provider terminal state is observed.

A successful private model version is saved as a candidate with review_status=pending and base_family=flux.1-dev. It is not activated in generation. A FLUX adapter is not compatible with Wan/LTX just because they all use LoRA. Geometry/identity are not guaranteed; representative quality/fidelity review and a compatible inference adapter are required before use.

## Reliability and verification

Catalog receipts and training state are service-written and RLS protected; workspace members can only read their own status. SQL functions are SECURITY INVOKER, explicitly denied to anon/authenticated. Composite foreign keys bind source, item and product to the same workspace. Workers receive record IDs, not credentials, ZIP bytes or signed storage URLs. A five-minute outbox recovery job covers missed dispatches and polls in-progress/ambiguous training.

Future work: native inventory-location reconciliation and confirmed paid-ad pausing; merchant OAuth; connection UI; dataset review UI and model approval/inference integration; retention cleanup; bounded customer-funded training allowances; then the later creative-factory, publishing, decision and monetization phases.
