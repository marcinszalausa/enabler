# Social OAuth callback state

## Browser and server binding
Starting a connection verifies the user and editor role, checks the plan and
creates a cryptographically random 32-byte nonce. Its SHA-256 hash is registered
through a service-role RPC with the user, workspace, Zernio profile, platform and
a server-enforced ten-minute expiry. Only the hash is stored in the database.

The nonce is added as gooidy_state to the custom redirect URL and set in an
HttpOnly, Secure, SameSite=Lax cookie. Production uses a __Host- cookie with
path=/ and no Domain attribute to prevent sibling-domain cookie injection.
Local development uses a separate non-Secure cookie. Callback origins are
limited to gooidy.com/www, the deployment's configured Vercel URLs, and local
loopback addresses in development. Additional production custom domains must
be deliberately added to the trusted-origin list.

Zernio documents that custom redirect parameters are preserved unless they
collide with its own fields:
https://docs.zernio.com/guides/connecting-accounts

On callback, getUser verifies the signed-in user. The nonce and browser cookie
must match before any state query. A service-role RPC atomically deletes the
pending row and returns its workspace/profile/platform only for that same user,
a still-valid editor role and a still-matching local profile. The callback's
profile and platform must then match the stored context before account sync or
quota enforcement. Provider errors/cancellations still require the matching
browser/server state, but perform no account mutation. Account ownership checks
from the prior authorization fix remain in place.

## Replay and failure behavior
There is one pending attempt per user, across devices/tabs. A newer attempt
supersedes the older one; one callback wins concurrent consumption. Missing,
expired, mismatched, duplicated or already-consumed state fails closed. A
mismatched callback does not clear the current browser cookie. If a request
matches the browser/server nonce but its resource fields are invalid, its
server attempt is consumed and the user must start again.

State is consumed before synchronization/provider side effects. A crash or
database/network error after consumption cannot replay those side effects;
the user must restart the connection flow. This is at-most-once admission,
not a durable workflow or an exactly-once provider transaction.

Zernio still owns the upstream platform OAuth/PKCE exchange. This change
protects Gooidy's callback admission; it does not replace or audit Zernio's
upstream OAuth implementation. The provider can have connected an account before
returning to Gooidy, even if Gooidy subsequently rejects an expired callback.

Raw nonces and auth/callback URLs are not logged by the changed connection
handlers. State rows are deleted on consumption; expired unconsumed rows are
replaced on the user's next attempt and removed when the user is deleted.

## Rollout and verification
Apply the additive social_connect_state migration before deploying the app.
Existing provider connections are unchanged. Any OAuth flow initiated by the
old app has no state record/cookie and must be restarted after deployment.
Rolling back the application removes callback state enforcement; leave the
additive schema in place.

Tests exercise nonce/cookie/origin validation, user/profile/platform binding,
expiry, changed roles, supersession, cancellations, replay and twenty
concurrent database consumers on PostgreSQL 16 and 17. TypeScript, lint and
Vercel preview builds also run. A live browser flow through the external
provider is not automated here; deployment verification should include a
normal connection and cancellation from the dashboard.
