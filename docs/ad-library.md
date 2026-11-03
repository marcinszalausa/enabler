# My ads
The authenticated /dashboard/ads page lists accessible saved ads across products and workspaces, newest first. Each page contains at most 24 creatives. Image/video and personal-favorite filters are applied in the database, with deterministic created_at/id ordering and one lookahead row. Active generations, rejected creatives and orphaned products are omitted; saved partial outputs remain available.

Favorites are stored per authenticated user in creative_favorites. RLS requires both ownership and current access to the creative. Workspace viewers may keep their own favorites, without gaining editing or publishing privileges. Other members cannot read or modify those favorites; lost membership hides them. No UPDATE privileges or administrative clients are used. Repeated save/remove requests express a desired state rather than toggling blindly.

Browsing uses bounded authenticated image previews, versioned by the current brand kit so logo, color and font edits invalidate browser caches. Videos have no media element or network source until the preview dialog opens. Downloads retain the existing original export path. Open ad links to the exact selected creative in its product's existing review flow; it never posts or spends credits. Favorites are separate from the existing tab-local publishing navigation hint.

## Deployment
Apply the additive creative_favorites migration before deploying the application. It adds the protected table and lookup/chronology indexes without modifying balances or existing creative rows. Check RLS/grants and database advisors after application. For an application rollback, revert the app and leave the table intact to preserve user favorites.

## Verification
The ad-library workflow uses disposable PostgreSQL 17 and PostgREST, authenticates fixture users with test-only tokens and tests the real Supabase query builder. SQL and API tests cover ownership, workspace isolation, viewers, revoked access, idempotency, pagination, kind/favorite filters and foreign-key cleanup. Browser tests use the real page/actions against that disposable database, replace only the auth client and media fixtures, and restore files afterward. They cover save/reload/remove, failed-save recovery, previews, links, responsive/RTL layouts and unchanged credits. No production generation or publishing occurs.
