# First Soft Mila connection

This is a one-time setup for the operator of Gooidy. Customers use Dashboard
→ Stores, approve access in Shopify, and choose products. They never enter
provider keys or upload a catalog file.

## 1. Create the service accounts

- Shopify Dev Dashboard: https://dev.shopify.com/dashboard. Create the Gooidy
  app using the account that can administer Soft Mila. Use a distribution
  method appropriate for this pilot; public merchant distribution requires
  its own Shopify approvals.
- Inngest: https://app.inngest.com. Create a production environment for Gooidy.
- Replicate: https://replicate.com. This is needed later for training, not to
  connect a store. Keep paid training disabled while connecting Shopify.

## 2. Configure the Shopify app

| Setting | Value |
| --- | --- |
| App URL | https://gooidy.com/dashboard/stores |
| Embedded | No; standalone app |
| Use legacy install flow | Off; app-specific webhooks require managed scopes |
| OAuth redirect URL | https://gooidy.com/api/shopify/callback |
| Scopes | read_products,read_inventory |
| API version | 2026-10 |
| Webhook URL | https://gooidy.com/api/shopify/webhooks |
| Product/lifecycle topics | products/create, products/update, app/uninstalled |
| Compliance topics | customers/data_request, customers/redact, shop/redact |

Save and release the app configuration. An app's successful OAuth flow alone
does not prove that its webhooks have been registered.

## 3. Configure hosting and workers

Use Vercel → Gooidy project → Settings → Environment Variables. Keep keys
server-only, scoped to production, and out of source control and chat. Use
the existing .env.example as the list of variable names. Configure:

- CATALOG_ENCRYPTION_KEY: a securely generated 32-byte key encoded as 64 hex
  characters. Preserve this key after credentials have been encrypted.
- INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY and
  INNGEST_SERVE_ORIGIN=https://gooidy.com.
- SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET and
  SHOPIFY_APP_ORIGIN=https://gooidy.com.
- CATALOG_INGESTION_ENABLED=true and SHOPIFY_CONNECT_ENABLED=true only when
  their required configuration is present.
- Keep CATALOG_TRAINING_ENABLED=false.

Redeploy after environment changes and sync the Inngest app using
https://gooidy.com/api/inngest. The app identifier is gooidy-catalog.
Account signup, storing keys, app sync and a successful live request are
separate steps; none is implied by deploying the source code.

## 4. Verify, then connect from the dashboard

The operator can run `npm run catalog:setup:check` with the production
environment securely supplied. The command performs offline configuration
checks only. It prints names and statuses, never values. It exits with 1
when setup is incomplete. Do not paste a secret file into chat.

Configuration passing is not a provider or database health check. Verify
the app release and Inngest sync separately. Connect Soft Mila through the
workspace owner's Dashboard → Stores using its myshopify.com domain, then
verify import, a product update, refresh and uninstall/reconnect. The current
store entitlement requires an active qualifying Grow or Scale subscription;
a selected plan or preview account does not grant that entitlement. Do not
grant paid access by changing a plan name or editing a browser request.

## 5. Check the first product before training

Choose The Cabin Raglan Set and open Check product photos. Follow the photo
guidance in catalog-photo-review.md. The pilot needs at least ten distinct,
suitable high-resolution originals. Review product identity, color, geometry
and image rights as well as the technical check results.

Only after agreeing a training budget, configuring account-level spending
controls, pinning the trainer and creating the private Replicate destination
should an operator enable the existing guarded one-product pilot and its
single training allowance. `npm run catalog:setup:check -- --training` checks
the extra variable formats; it does not verify the provider's model visibility,
the training allowance, photo suitability, billing or budget enforcement.
The existing cancellation watchdog is not a hard dollar cap.

Model approval and compatible inference still require representative sample
ads. Do not activate a model merely because training reports success.
