# Dashboard Shopify connection
Customers use Dashboard → Stores → Connect Shopify, enter their myshopify.com address and approve read_products/read_inventory access in Shopify. No merchant client secrets or API keys are entered in Gooidy. The callback returns to the dashboard and starts a background catalog sync. Products can be selected for the existing ad-creation flow. Store connection itself does not charge credits or start LoRA training.

## One-time platform setup
A platform operator must create/configure Gooidy's standalone Shopify app, its distribution method and any required Shopify review before enabling this for unrelated merchants. A single-store custom app is not a public multi-merchant distribution approval. No Shopify credentials or store installation have been provisioned by committing this code.

Set production SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET, SHOPIFY_APP_ORIGIN=https://gooidy.com, CATALOG_ENCRYPTION_KEY, CATALOG_INGESTION_ENABLED and the Inngest event/signing keys. Sync /api/inngest to Inngest Cloud. Enable SHOPIFY_CONNECT_ENABLED only after the app and signed webhook subscriptions are configured. Without these, the dashboard shows the connection as unavailable and offers the existing product-link flow.

Shopify app URL: https://gooidy.com/dashboard/stores
Exact OAuth redirect URL: https://gooidy.com/api/shopify/callback
App is standalone, not embedded. Scopes: read_products,read_inventory.
Set use_legacy_install_flow=false in the published app configuration for app-specific webhooks. The standalone connection still uses authorization-code OAuth; do not enable legacy installation for this configuration.
API version: 2026-10.
App-specific webhook URL: https://gooidy.com/api/shopify/webhooks
Topics: products/create, products/update, app/uninstalled.
Mandatory compliance topics at that URL: customers/data_request, customers/redact, shop/redact. Configure these in the Dev Dashboard or app TOML and release that version. They cannot be assumed to exist because an OAuth callback succeeded.

## Security and lifecycle
OAuth is owner-authorized and bound to a signed callback, a secure HttpOnly SameSite browser nonce, the initiating user, workspace, store and a ten-minute single-use database state. Fresh ownership is checked again before consuming it. Callback query signing follows Shopify's URLSearchParams encoding, including %20 for spaces. Duplicate/unexpected parameters fail closed. Tokens use expiring offline access with encrypted refresh tokens. Refreshes use a database lease and compare the stored credential version before replacing it.

A store is bound to one workspace; another workspace cannot claim it. Reinstall rotates the installation id and invalidates stale worker writes. Tokens and state tables are service-only with RLS. The page passes only nonsecret status fields to rendered components. Logs/events contain record IDs, never token responses or callback URLs.

Catalog imports use bounded, paginated GraphQL requests and durable Inngest steps. Source snapshots are idempotent and preserve newer product updates. Customer/order records are not requested. Initial inventory is unknown rather than guessed zero. Product webhooks subsequently update the existing catalog inventory snapshot; location-level real-time stock reconciliation and automatic paid-ad pausing are outside this connection feature.

The catalog is separate from saved ad projects. Selecting Create ads takes the merchant to the existing product onboarding; sync does not generate ads, spend generation credits or create duplicate saved ad projects.

Disconnect stops the connection and erases stored credentials even when access is expired, then attempts Shopify appUninstall to revoke provider access. If provider revocation cannot be confirmed, the dashboard clearly directs the owner to remove the app in Shopify. Signed app/uninstalled also disables sync. A disconnected store's saved Gooidy ads are retained. If access was already revoked/expired, reconnection or uninstalling from Shopify may be required to finish provider-side revocation.

## Privacy before broader launch
Customer data webhooks have no customer/order records to erase/export because those scopes are not requested. shop/redact clears connection data and private datasets. If a source has provider training artifacts, erasure deliberately remains unacknowledged until an operator removes them; full trained-model retention automation must be completed before enabling training with public distribution. Do not claim public-app compliance certification from these endpoints alone.

## Verification and activation
Tests mock Shopify; CI never installs a real app or creates a paid training. Unit tests cover Shopify HMAC encoding, unsafe store hosts, scopes and callback replay/owner rejection. PostgreSQL tests cover workspace theft, credential isolation, reinstall/disconnect and twenty concurrent state consumers. TypeScript, lint and production build must pass. A real Shopify development-store approval, first import, webhook update, expiry refresh and uninstall remain activation acceptance checks requiring the platform app credentials.
