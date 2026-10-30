# Workspace authorization review

## Fixed by this PR
1. The social callback used a URL-supplied accountId directly when deleting
   over-limit provider accounts. It now resolves an account scoped to the
   authorized workspace before calling the provider, and scopes the local
   deletion too. Missing/foreign accounts cause no provider mutation.
2. Generation and publishing operations checked membership, allowing viewers
   to spend credits, publish, change schedules or manage social accounts through
   service-role operations. User-initiated writes now require the existing
   is_workspace_member(ws, 'editor') check with the user's authenticated client.
   Owners inherit editor permission. Errors or non-boolean results deny access.
3. Creative RLS allowed editors to update every column of an accessible row,
   including generation_id and storage_path. That could forge a relationship
   to a showcased run or redirect privileged media handling. Column grants now
   permit only headline, primary_text, cta and status updates from authenticated
   clients. Service-role generation output writes remain unchanged.
4. Brand kits could reference another workspace's logo path. A database check
   now restricts non-null paths to a filename under that workspace's /brand/.
5. Callback synchronization and plan reads could silently ignore database
   failures. They now propagate failures so limit enforcement stops.

## Entry points checked
- Product creation and image/video generation actions.
- Social connect callback, connect/disconnect, scheduling, publishing and cancel.
- Brand kit saves and showcase actions (which also retain the team email gate).
- Manual video advancement.
- Private creative downloads and the deliberate public-showcase fallback.
- Background image/video generation, autopilot, profile sync, and webhook
  entry points, following their inputs back to user authorization or signed
  provider events.

Private media and data reads remain available to viewers within their workspace.
Foreign users remain subject to RLS. Public showcase media is intentionally
accessible without workspace membership. This source review does not certify
the entire authentication system or exercise every live browser session.

## Validation
Unit tests cover the role-check contract and forged/missing/owned callback
accounts, provider/local deletion ordering and database failures. PostgreSQL
16/17 tests exercise real RLS with owner, editor, viewer, outsider and anonymous
roles, private storage row isolation, membership escalation attempts, protected
creative columns, credit-column permissions and logo path checks.

The disposable SQL fixture models Supabase API grants and Storage metadata; it
does not replace end-to-end Supabase JWT or signed-download tests. Read-only
production queries found no existing cross-workspace creative/generation or
storage-path mismatches, and existing logo paths use their workspace prefix.

## Rollout and follow-up
Apply the additive workspace_authorization migration before deploying this app.
No production data is rewritten. Existing protected-column update integrations
will be rejected; the current application does not edit those fields from user
clients. The migration leaves service-role grants unchanged. Roll back the app
if needed while retaining the database restrictions.

The UI still displays some mutation controls to viewers; server enforcement
blocks them. A role-aware UI can improve feedback separately. Membership is
checked at request admission; in-flight provider operations are not cancelled
if a role changes midway through a request.

Separate follow-ups: OAuth callback state/CSRF binding, membership provisioning
and invitation flows, durable job recovery, and URL-fetch/SSRF protections.
This PR fixes the confirmed tenant and role gaps rather than claiming a full
security certification. No OAuth provider settings are changed.
