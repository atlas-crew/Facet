---
id: TASK-189.3
title: Add admin workspaces view
status: To Do
assignee: []
created_date: '2026-04-22 03:28'
labels:
  - admin
  - proxy
  - frontend
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
- [ ] #1 `GET /admin/workspaces` returns one row per workspace joined with workspace_snapshots and owner info, ordered by updated_at DESC
- [ ] #2 Result includes snapshot_revision NULL when no snapshot row exists
- [ ] #3 Endpoint supports ?limit (default 100, max 500), ?tenant_id filter, and ?user_id filter (member-of)
- [ ] #4 Endpoint is gated by existing requireAdmin middleware — returns 403 without admin claim
- [ ] #5 /admin route has a 'Workspaces' subnav entry
- [ ] #6 Workspaces view renders a table with name, owner_email, revision, snapshot_revision, updated_at, snapshot_exported_at
- [ ] #7 Rows where revision !== snapshot_revision are visually highlighted
- [ ] #8 Integration tests cover happy path, NULL snapshot path, and 403 path
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
