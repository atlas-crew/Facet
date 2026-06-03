---
id: TASK-189.3
title: Add admin workspaces view
status: Done
assignee:
  - '@codex'
created_date: '2026-04-22 03:28'
updated_date: '2026-05-24 19:13'
labels:
  - admin
  - proxy
  - frontend
milestone: m-12
dependencies:
  - TASK-189.1
references:
  - proxy/
  - proxy/postgresWorkspaceStore.js
  - src/routes/admin/
  - supabase/migrations/20260405_001_initial_schema.sql
parent_task_id: TASK-189
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context

Additive slice of the admin panel work (parent: TASK-189). Depends on TASK-189.1 for the admin auth scaffolding, `/admin` route, subnav pattern, and endpoint conventions. Do not re-establish any of that.

## What this enables

Operational visibility into workspaces and their snapshot state. Answers "how many workspaces does this user have?", "when was this workspace last exported?", "what revision is current?". Useful for debugging "my resume isn't saving" support requests by comparing the client's claimed revision to the server's stored snapshot.

## Scope

### Proxy (`proxy/`)
Add `GET /admin/workspaces` mounted under `requireAdmin`:
- Joins `workspaces` with `workspace_snapshots` and (optionally) `workspace_memberships` to return one row per workspace with:
  - `tenant_id, workspace_id, name, revision, created_at, updated_at`
  - `snapshot_revision, snapshot_exported_at` (from `workspace_snapshots`, NULL if no snapshot yet)
  - `owner_user_id, owner_email` (from the default membership joined to `actors`)
- Orders by `updated_at DESC`
- Supports `?limit=` (default 100, max 500), `?tenant_id=` filter, and `?user_id=` filter (restrict to workspaces where the user is a member)

### Client (`src/routes/admin/`)
- Add a "Workspaces" entry to the `/admin` subnav
- Render a table: `name | owner_email | revision | snapshot_revision | updated_at | snapshot_exported_at`
- Highlight rows where `revision !== snapshot_revision` (indicates drift between the live workspace revision and the last successful snapshot — a debugging signal)
- Filter inputs for `tenant_id` and `user_id` (plain inputs; no autocomplete required)

## Tests

- Proxy: integration test for happy path with the full join returning expected shape, and 403 path (reuse shared admin-403 helper if one exists from 189.1).
- Proxy: test that `snapshot_revision` is NULL when no snapshot row exists for a workspace.
- Client: render test that rows with mismatched revisions receive the highlight class/style.

## Out of scope

- Editing workspace state (write endpoints; deferred)
- Workspace impersonation / "view as this user" (deferred — needs separate authz scoping)
- Historical snapshot browsing (only the latest snapshot is stored per schema design)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `GET /admin/workspaces` returns one row per workspace joined with workspace_snapshots and owner info, ordered by updated_at DESC
- [x] #2 Result includes snapshot_revision NULL when no snapshot row exists
- [x] #3 Endpoint supports ?limit (default 100, max 500), ?tenant_id filter, and ?user_id filter (member-of)
- [x] #4 Endpoint is gated by existing requireAdmin middleware — returns 403 without admin claim
- [x] #5 /admin route has a 'Workspaces' subnav entry
- [x] #6 Workspaces view renders a table with name, owner_email, revision, snapshot_revision, updated_at, snapshot_exported_at
- [x] #7 Rows where revision !== snapshot_revision are visually highlighted
- [x] #8 Integration tests cover happy path, NULL snapshot path, and 403 path
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-05-24 Codex started parallel-agent implementation lane for admin workspaces. Worker split: proxy/API tests owned separately from admin UI/tests; coordinator will integrate, verify, commit, push, and close tasks when gates pass.

2026-05-24 Codex parallel-agent closeout: implemented GET /admin/workspaces through the existing admin auth/rate-limit path, backed by in-memory and Postgres admin stores. Added the Workspaces admin tab with tenant/user filters, workspace snapshot columns, and drift highlighting when revision differs from snapshot_revision. Integrated Copernicus proxy lane and Beauvoir UI lane, then remediated independent review/audit findings around accessibility, malformed-row visibility, telemetry, rate limits, and token failure handling. Verification: pnpm exec vitest run src/test/adminApi.test.ts src/test/AdminPage.test.tsx src/test/AppShellAdminNav.test.tsx passed (3 files, 64 tests); pnpm run lint passed; pnpm run typecheck passed; pnpm run build passed with existing chunk-size warnings; pnpm run test passed (173 files, 2501 tests); git diff --check passed. Review artifact: .agents/reviews/review-20260524-150829.md (P0/P1/P2 clear; P3 component-size/expansion-stability notes non-blocking). Test audits clean: .agents/reviews/test-audit-20260524-150101.md and .agents/reviews/test-audit-20260524-150703.md.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the admin Workspaces view and /admin/workspaces API. The endpoint returns workspace rows with snapshot and owner metadata, supports limit/tenant_id/user_id filters, is admin-gated and rate-limited, and preserves malformed-but-identifiable rows for operations debugging. The UI renders the Workspaces subnav/table, tenant/user filters, empty/error states, refresh, and drift highlighting for revision mismatches. Verification passed: focused admin tests (64), full test suite (2501), lint, typecheck, build, and diff whitespace.
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
