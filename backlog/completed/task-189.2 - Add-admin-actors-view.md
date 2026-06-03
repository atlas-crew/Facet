---
id: TASK-189.2
title: Add admin actors view
status: Done
assignee:
  - '@codex'
created_date: '2026-04-22 03:28'
updated_date: '2026-05-24 17:58'
labels:
  - admin
  - proxy
  - frontend
milestone: m-12
dependencies:
  - TASK-189.1
references:
  - proxy/
  - src/routes/admin/
  - supabase/migrations/20260405_001_initial_schema.sql
parent_task_id: TASK-189
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context

Additive slice of the admin panel work (parent: TASK-189). Depends on TASK-189.1, which establishes the `requireAdmin` middleware, `useIsAdmin()` hook, `/admin` route scaffolding, and endpoint/view pattern. This task copies that pattern to add a read-only actors directory.

Do not re-establish auth plumbing; reuse what 189.1 shipped.

## What this enables

Operational visibility into who has signed up. Answers "did this specific user actually sign in?", "when did they sign up?", "how many accounts are under this tenant?". Essential for debugging support requests where the founder needs to correlate an email to a `user_id`.

## Scope

### Proxy (`proxy/`)
Add `GET /admin/actors` mounted under the existing `requireAdmin` middleware:
- Returns rows from the `actors` table, ordered by `created_at DESC`
- Supports `?limit=` (default 100, max 500), `?tenant_id=` filter, and `?q=` (substring match against `email`, case-insensitive)
- Returns `{ user_id, tenant_id, account_id, email, created_at }`
- Joins `workspace_memberships` to include a `workspace_count` aggregate per actor

### Client (`src/routes/admin/`)
- Add an "Actors" entry to the `/admin` subnav (next to the existing "Webhooks" from 189.1)
- Render a plain table: `email | tenant_id | account_id | workspace_count | created_at`
- Add a simple text input that debounces into the `?q=` query param (300ms debounce)
- No row actions — this view is read-only

## Tests

- Proxy: integration test for the happy path (returns actors), the filter path (`?tenant_id=` narrows results), and the 403 path (non-admin). The 403 path can be a single shared test helper reused across all admin endpoints if 189.1 didn't already create one.
- Proxy: boundary test that `?limit=` is clamped to 500.
- Client: render test that the search input updates the query string with a debounce.

## Out of scope

- Editing or impersonating actors (write endpoints; deferred to a later task)
- CSV export
- Full-text search across JSONB fields on related tables
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `GET /admin/actors` returns rows from the actors table with workspace_count aggregate, ordered by created_at DESC
- [x] #2 Endpoint supports ?limit (default 100, max 500 clamped), ?tenant_id filter, and ?q email substring filter (case-insensitive)
- [x] #3 Endpoint is gated by the existing requireAdmin middleware — returns 403 without admin claim
- [x] #4 /admin route has a new 'Actors' subnav entry alongside 'Webhooks'
- [x] #5 Actors view renders a table with email, tenant_id, account_id, workspace_count, created_at columns
- [x] #6 Search input debounces (300ms) into the ?q query param
- [x] #7 Integration test covers happy path, filter path, and 403 path
- [x] #8 Boundary test confirms ?limit is clamped to 500
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation plan (Codex, 2026-05-24):
1. Reuse the 189.1 admin scaffold: inspect `requireAdmin`, existing admin endpoint/store patterns, AdminPage subnav/state, and tests before editing.
2. Add a read-only `/admin/actors` proxy path backed by the existing Postgres store, with default/max limit handling, tenant_id filter, q email substring filter, created_at DESC ordering, and workspace_count aggregation.
3. Extend the admin client view with an Actors subnav tab, table columns, loading/error/empty states, and a 300ms debounced q query parameter.
4. Add proxy integration coverage for happy path, tenant filter, 403, and limit clamp; add client coverage for debounced query param behavior.
5. Run focused tests, lint, build, independent review/audit if feasible, then update AC/DoD and commit atomically with `cortex git commit`.

Implemented TASK-189.2 (Codex, 2026-05-24): added read-only `/admin/actors` under existing `requireAdmin`; supports limit default/max clamp, tenant_id filter, literal case-insensitive q email search, oversized-q 400 validation, tenant-scoped workspace_count via Postgres subquery, no-store headers, and admin probe/read rate limits. Extended AdminPage with Actors subnav, table, debounced email query param, direct `/admin?q=...` actors initialization, loading/empty/error/forbidden states, and accessible visible-label search. Added tests for actors auth/403, invalid token probe rate limiting, tenant/q filters, literal wildcard search, oversized q, 500 clamp, normalization boundaries, Postgres SQL shape, Actors forbidden UI, debounced query string behavior, and query-param initialization. Independent review artifacts: `.agents/reviews/review-20260524-133621.md`, `review-20260524-134116.md`, `review-20260524-134442.md`, `review-20260524-134716.md`, `review-20260524-135147.md`; test audit artifact: `.agents/reviews/test-audit-20260524-135411.md`. P1/P2 findings from review/audit were remediated, including literal search semantics, q length cap, tenant-scoped counts, compatibility for createInMemoryAdminStore array fixtures, composite actor row keys, and actor rate-limit/normalization tests. Verification passed: focused admin tests (4 files, 30 tests), `pnpm run test` (173 files, 2465 tests), `pnpm run lint`, `pnpm run typecheck`, `pnpm run build` with existing chunk-size warnings, and `git diff --check`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed. Added the admin Actors directory view and `/admin/actors` proxy endpoint using the admin scaffold from TASK-189.1. Verification passed: focused admin tests (4 files, 30 tests), full `pnpm run test` (173 files, 2465 tests), `pnpm run lint`, `pnpm run typecheck`, `pnpm run build` with existing chunk-size warnings, and `git diff --check`. Independent source review and test audit were run; blocking findings were remediated.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
