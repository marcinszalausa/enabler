# Publish Gooidy's Shopify app configuration from a phone

The active-version detail page is read-only. App-specific webhook
subscriptions are defined in the configuration template under ops/shopify.
This procedure publishes that configuration to the existing Gooidy app;
Vercel continues to host the website and callback handlers.

## One-time credentials

1. In Shopify Dev Dashboard → Apps → Gooidy → Settings, find App CLI
   automation token and select Manage. Current Shopify routes this to
   organization service accounts.
2. Create a service account named Gooidy deployment. Choose a one-month token
   lifetime for the setup. Grant App development for Gooidy only. Do not grant
   Dev store management.
3. Copy the token directly into GitHub → marcinszalausa/enabler → Settings →
   Secrets and variables → Actions → Secrets → New repository secret.
   Name it SHOPIFY_SERVICE_ACCOUNT_TOKEN. Never paste it into chat, source,
   workflow inputs or repository variables.
4. On the Variables tab, add SHOPIFY_APP_CLIENT_ID containing Gooidy's
   Client ID from Shopify Settings. This is the public identifier, not the
   client secret. It must match SHOPIFY_CLIENT_ID in Vercel.

## Publish

Open the repository's Actions tab, select Publish Gooidy Shopify app,
choose Run workflow on main, then Run workflow. The job tests the template,
validates it with Shopify CLI 5.0.1, then publishes it. Publishing is manual;
pushes and pull requests only run checks with a fixture app identifier and
without deployment credentials. Shopify CLI validation itself requires the
app-scoped service credential, so that validation runs immediately before
publishing during a manual main-branch run. Unauthenticated CI checks do not
claim that Shopify has accepted the configuration.

The workflow keeps the standalone legacy OAuth flow, read_products and
read_inventory scopes, API version 2026-10 and all six existing handler
topics. It uses --allow-updates, not --allow-deletes. If Shopify reports that
publishing would delete existing app components, stop and reconcile the
app's existing configuration before changing the workflow. The new Gooidy
app shown during setup has no app extensions configured.

After a successful publish, verify the active Shopify version and webhook
subscriptions. Revoke or rotate the short-lived service token after setup
or before expiry, according to whether ongoing automated releases are
needed. This credential is for releasing Gooidy's app; customers never
need to create one to connect their store.

Then enable SHOPIFY_CONNECT_ENABLED for Production, redeploy Vercel, and
connect Soft Mila from an owner workspace with Grow/Scale entitlement.
Verify initial import, an updated product, and uninstall/reconnect. Keep
CATALOG_TRAINING_ENABLED=false until the first reviewed training pilot.

## References

- https://shopify.dev/docs/apps/build/webhooks/subscribe
- https://shopify.dev/docs/apps/build/cli-for-apps/service-accounts
- https://shopify.dev/docs/apps/launch/deployment/deploy-in-ci-cd-pipeline
- https://shopify.dev/docs/api/shopify-cli/app/app-deploy
