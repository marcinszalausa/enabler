# Founder store connection pilot
An operator can authorize one workspace owner to test one Shopify store for up to seven days using store_connection_pilots. Only service_role can write a grant. The database rejects longer grants; requests check expiry, revocation and current ownership. Grant metadata is readable only by the named current owner. No subscription, plan, credit balance, training allowance or other paid capability is granted.

The normal Grow/Scale entitlement continues unchanged. The pilot opens the existing catalog-only access gate for its owner and trusted workers, and database write guards restrict pilot connections and ingestion to Shopify and the grant's store host (with or without www). Other platforms/domains are denied. The dashboard labels the founder test and expiry and hides other platform connection buttons for a pilot-only owner.

Workers check the entitlement before accessing provider tokens. Expired or revoked pilots cannot import or read catalog data, reconnect, or enable catalog sources. Disconnect remains available. Existing encrypted credentials are retained until disconnection or existing erasure procedures; the grant does not promise deletion at expiry.

Activation is an operator action after verified owner identity and explicit founder authorization. Production grants must not be inserted by the migration. An operator records granted_at and expires_at exactly seven days apart on the authorized workspace and Shopify store host. Renewals require a separate deliberate authorization.

Rollback: revoke the grant (set revoked_at). Do not change billing data or fabricate a Stripe subscription. Keep the table and policies while any deployed code references them.
