# Native premium store connections
Store connections are included in Grow (plus) and Scale (growth), not Free or Launch (starter). Signup plan preferences do not grant access. Active/trialing/past_due verified subscriptions use the same billing states as existing paid entitlements. Workspaces' billing fields cannot be updated by authenticated users.

Customers choose Shopify, WooCommerce, Wix, Squarespace or BigCommerce from Dashboard → Stores, enter their store address and approve access at the platform. They never paste API keys, create developer apps or upload CSV files. These are native authenticated connections, not a public crawler disguised as an integration. No website crawler is deployed by this change.

## Platform setup and activation
Each provider is disabled until its production app configuration and integration acceptance are complete. The dashboard displays the platform button with an unavailable state. The platform operator performs this once; merchants don't handle it.
- Shopify: existing platform app setup in shopify-dashboard-connection.md.
- WooCommerce: native /wc-auth/v1/authorize with scope=read. Keys are delivered server-to-server; their validity is checked against the intended store through DNS-pinned HTTPS. No platform-wide Woo client secret is required.
- Wix: modern external install, postInstallationUrl with nonce, signedInstance verification and client_credentials plus instance_id. The deprecated custom authorization-code/refresh-token flow is not used. Set WIX_CLIENT_ID, WIX_CLIENT_SECRET, the current Wix external installer URL in WIX_INSTALL_URL, and WIX_SHARE_URL_ID for unlisted apps. Configure read-product permissions and Manage Your App; do not request owner email.
- Squarespace: registered OAuth client, website.products.read / website.inventory.read, offline access and securely rotated refresh tokens. Set SQUARESPACE_CLIENT_ID / SQUARESPACE_CLIENT_SECRET.
- BigCommerce: registered single-click app and direct installation button, with store_v2_products_read_only / store_v2_information_read_only. Set BIGCOMMERCE_CLIENT_ID / BIGCOMMERCE_CLIENT_SECRET. The callback handles external/control-panel framing using an explicit top-level Continue to Gooidy bridge.

Enable the provider's PROVIDER_CONNECT_ENABLED flag only after its app registration/distribution and development-store acceptance. All connections also require the existing catalog configuration and production Inngest keys, with /api/inngest synced. Native callback URLs are https://gooidy.com/api/stores/PROVIDER/callback. All providers must be tested with real development-store credentials before claiming them live. Marketplace listing, approvals and provider-level uninstall/revocation lifecycle acceptance remain operator activation prerequisites; committing this code does not provision app registrations.

## Binding and security
OAuth intents are bound to the initiating user, workspace, provider, store website and a secure HttpOnly browser nonce. Receipt finalization rechecks owner access and the paid tier, checks provider-reported store identity against the expected website, and consumes intent and receipt in one transaction. Wix callbacks need a valid, current signed instance. Woo's server callback only stages keys after actual API verification and final binding occurs when the initiating browser returns. BigCommerce doesn't promise OAuth state round-tripping, so its authenticated provider receipt remains unassigned until a top-level return validates the initiating browser, paid owner and expected store identity. Replaying a receipt or binding a store already owned by a different workspace fails closed.

All credential/intent/receipt tables are service-only with RLS. Native sync functions pass only IDs through Inngest; token responses and URLs carrying authorization codes are never logged. Woo authorization headers are pinned to the original HTTPS origin and cannot follow cross-origin redirects. Tokens are encrypted; rotating credentials use leases and installation/version guards.

## Catalog and plan lifecycle
Inngest imports paginated native product APIs. Catalog browsing is shared with Shopify and selecting a product opens the existing ad flow, without generating or spending credits automatically. Products lacking usable images are skipped; inventory stays unknown unless the provider gives an authoritative quantity or zero. Connected catalogs refresh about hourly and can be refreshed manually. This does not claim real-time inventory monitoring or paid-ad pausing.

API, background and database checks enforce the plan. Downgrades disable sources, fail queued deliveries and pause imports. Cached catalogs become unreadable through authenticated Data API access on lower tiers. Owners can still disconnect and erase stored credentials. Upgrading and refreshing/reconnecting restores access. Local disconnect doesn't pretend to revoke provider permissions when the platform requires the owner to remove the app in its admin.

Tests mock provider calls and use disposable PostgreSQL. No live store, paid training, billing transaction or app-market submission is performed by CI.
