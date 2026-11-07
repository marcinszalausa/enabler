# Founder store access and limited pilots

An operator can authorize a verified workspace owner for one Shopify store using store_connection_pilots. Only service_role can write a grant. Grant metadata is readable only by the named current owner. This never creates a subscription, changes a plan, refills credits, or enables paid training.

- access_kind=founder: ongoing access with expires_at NULL; no subscription or seven-day cutoff.
- access_kind=pilot: expires_at is required and must be within seven days of granted_at.
- Both require an unrevoked grant, a grant start in the past, and current ownership. Neither can be self-granted.

The normal Grow/Scale subscription entitlement is unchanged. Customers do not receive a seven-day store trial through this exception. Grants open catalog-only access for their named owner and trusted workers, with database write guards restricted to Shopify and the authorized store host (with or without www). Other platforms/domains are denied.

Workers check access before reading provider tokens. Revoked grants, expired pilots and ownership loss stop catalog reads/imports/reconnection. Disconnect remains available; encrypted credentials are retained until disconnection or existing erasure procedures.

Activation or conversion to ongoing founder access requires explicit authorization and verified owner identity. Migrations never insert production grants. Set access_kind=founder and expires_at=NULL only for the authorized existing founder grant. Preserve the workspace's billing, credit and training fields.

Rollback: set revoked_at. Keep the schema while deployed code references it. Never fabricate Stripe subscriptions or change customer plans as a shortcut.
