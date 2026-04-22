---
id: TASK-189.1
title: Bootstrap admin auth and webhooks view
status: To Do
assignee: []
created_date: '2026-04-22 03:28'
labels:
  - admin
  - auth
  - proxy
  - frontend
dependencies: []
references:
  - proxy/
  - proxy/postgresWorkspaceStore.js
  - src/utils/hostedSession.ts
  - src/router.tsx
  - src/components/AppShell.tsx
  - src/test/facetServer.test.ts
  - supabase/migrations/20260405_001_initial_schema.sql
parent_task_id: TASK-189
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context

This is the auth-bootstrap slice of the admin panel work (parent: TASK-189). It proves the entire admin auth path end-to-end while delivering the single highest-value view first: a UI for browsing recent Stripe webhook receipts. When Stripe weirdness happens at 2am, this view saves more time than every other admin view combined.

This subtask establishes the patterns (proxy middleware, endpoint shape, client gating, route layout) that subtasks 2–4 will copy.

## Architectural constraints (from parent)

- Admin identity is `auth.users.app_metadata.role = 'admin'` on the Supabase user. NOT `user_metadata` (that's user-writable and unsafe for authz).
- The proxy already verifies the Supabase JWT to resolve `actors`. Reuse that verification path — do NOT add a second JWT decoder. If the existing path doesn't verify signatures (only decodes the payload), fix that first; admin authorization MUST sit on top of verified claims.
- Server enforcement is the only real check; client `useIsAdmin` is for UI gating only.

## Scope

### Proxy (`proxy/`)
1. Add a `requireAdmin(req, res, next)` middleware that:
   - Reads the verified JWT claims attached to `req` by the existing auth middleware
   - Returns 403 if `claims.app_metadata?.role !== 'admin'`
   - Logs the rejected `user_id` (not the token) for audit visibility
2. Add a `GET /admin/webhooks` endpoint mounted under `requireAdmin`:
   - Returns rows from `webhook_event_receipts`, ordered by `processed_at DESC`
   - Supports `?limit=` (default 100, max 500) and `?since=` (ISO timestamp)
   - Returns `{ event_id, event_type, tenant_id, account_id, processed_at, payload }`. `payload` is the full JSONB.

### Client (`src/`)
1. Extend `src/utils/hostedSession.ts` to expose the admin claim from the current session (read from JWT `app_metadata.role`).
2. Add a `useIsAdmin()` hook (location: alongside other session hooks; if none exists, create `src/hooks/useIsAdmin.ts`).
3. Add `/admin` route in `src/router.tsx` and `src/routes/admin/AdminPage.tsx`:
   - Subnav with one entry initially: "Webhooks" (subtasks 2–4 add the rest)
   - Webhooks view: simple table — `processed_at | event_type | account_id | event_id`, with a row-click expander showing the JSON `payload`
   - No fancy styling required; reuse existing CSS variables from the design system
4. Sidebar (`src/components/AppShell.tsx`): show the admin nav entry only when `useIsAdmin()` is true.

## Tests

- Proxy: unit test `requireAdmin` returning 403 for missing claim, missing `app_metadata`, and `role !== 'admin'`; 200/next() for the admin case. Use the existing test patterns in `src/test/facetServer.test.ts`.
- Proxy: integration test `GET /admin/webhooks` happy path + 403 path.
- Client: render-test that the admin nav entry is hidden when `useIsAdmin()` returns false and visible when true.

## Manual smoke (after merge)

1. Founder runs the SQL claim-set documented in the parent task.
2. Sign out / sign back in (so the new claim is in the JWT).
3. Visit `/admin` — webhook list should render. Visit as a non-admin (incognito with a different account) — `/admin` should be hidden from nav and a direct visit should show an empty/forbidden state (the API call returns 403).

## Out of scope

- The other three views (actors, workspaces, billing) — those are subtasks 2, 3, 4.
- Pagination beyond simple `?limit=` and `?since=`.
- Search/filter UI on the webhook table.
- Replay/resend actions on webhooks (would be a write endpoint; deferred).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 proxy exports a `requireAdmin` middleware that reads the admin claim from already-verified JWT claims (does not re-decode)
- [ ] #2 Middleware returns 403 with a clear error body when the claim is missing or not 'admin', and logs the rejected user_id
- [ ] #3 `GET /admin/webhooks` returns rows from webhook_event_receipts ordered by processed_at DESC with ?limit (default 100, max 500) and ?since (ISO timestamp) support
- [ ] #4 `useIsAdmin()` hook returns true iff the current session JWT has app_metadata.role === 'admin'
- [ ] #5 /admin route exists and renders a webhook table with row-expander showing JSON payload
- [ ] #6 Admin nav entry in AppShell sidebar is hidden when useIsAdmin() is false
- [ ] #7 Unit tests cover requireAdmin's three rejection cases (missing claim, missing app_metadata, wrong role) and the success case
- [ ] #8 Integration test covers GET /admin/webhooks happy path and 403 path
- [ ] #9 Render test confirms admin nav entry visibility tracks useIsAdmin()
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
