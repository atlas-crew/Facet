---
id: TASK-189.2
title: Add admin actors view
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
- [ ] #1 `GET /admin/actors` returns rows from the actors table with workspace_count aggregate, ordered by created_at DESC
- [ ] #2 Endpoint supports ?limit (default 100, max 500 clamped), ?tenant_id filter, and ?q email substring filter (case-insensitive)
- [ ] #3 Endpoint is gated by the existing requireAdmin middleware — returns 403 without admin claim
- [ ] #4 /admin route has a new 'Actors' subnav entry alongside 'Webhooks'
- [ ] #5 Actors view renders a table with email, tenant_id, account_id, workspace_count, created_at columns
- [ ] #6 Search input debounces (300ms) into the ?q query param
- [ ] #7 Integration test covers happy path, filter path, and 403 path
- [ ] #8 Boundary test confirms ?limit is clamped to 500
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
