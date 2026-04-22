---
id: TASK-189
title: Add platform admin panel and admin role
status: To Do
assignee: []
created_date: '2026-04-22 03:27'
labels:
  - admin
  - auth
  - proxy
dependencies: []
references:
  - proxy/
  - src/utils/hostedSession.ts
  - src/utils/facetEnv.ts
  - supabase/migrations/20260405_001_initial_schema.sql
  - src/router.tsx
  - src/components/AppShell.tsx
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context

Facet currently has Supabase Auth (GitHub OAuth) and a Postgres backend behind the Fly proxy, but no concept of a platform-level administrator distinct from workspace owners. The founder needs read-only operational visibility into actors, workspaces, billing accounts, and Stripe webhook receipts so production weirdness is debuggable from a UI rather than ad-hoc SQL.

This is the parent task tracking the end-to-end work. Implementation is split into one auth-bootstrap subtask plus three additive view subtasks, so each subtask is one focused PR.

## Architecture decisions (already made)

- **Admin identity** is a tamper-proof claim on the Supabase user: `auth.users.app_metadata.role = 'admin'`. `app_metadata` is writable only by the Supabase service role, so it is safe to trust on the server. `user_metadata` is user-writable and must NOT be used for authorization.
- **Workspace role and platform role are distinct.** The existing `workspace_memberships.role` CHECK constraint (currently `= 'owner'`) MUST NOT be widened to encode platform admin. Platform admin is a property of the actor relative to the platform, not relative to a workspace.
- **Authorization lives in the proxy**, not in Postgres RLS. The SPA hits Supabase only for auth; all DB writes go through `proxy/`. So a `requireAdmin` middleware in the proxy is sufficient. RLS would only matter if the SPA started talking to PostgREST directly.
- **Read-only first.** No write/mutation endpoints in scope here. Write actions (refund a pass, force-grant entitlement, impersonate a workspace) are deliberately deferred until needed, because each one needs separate authorization scoping (e.g., `?confirm_tenant_id=…`) and audit logging.
- **No separate admin SPA.** The admin route lives inside the existing app at `/admin`. Hidden from sidebar nav unless the admin claim is present. Server still enforces; client just hides.

## Prerequisite (manual, not a subtask)

Before subtask 1 can be smoke-tested end-to-end, the founder must run a one-time SQL claim-set in the Supabase SQL editor:

```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'::jsonb
where email = 'ncf423@gmail.com';
```

This is the founder's responsibility (it touches the `auth` schema, not application schema). No migration file.

## Subtask sequencing

1. **Bootstrap admin auth + webhooks view** — the MVP slice. Proves the auth plumbing end-to-end with the highest-value first view (Stripe webhook debugging).
2. **Add admin actors view** — additive, depends on (1).
3. **Add admin workspaces view** — additive, depends on (1).
4. **Add admin billing view** — additive, depends on (1).

Subtasks 2–4 are independent of each other and can ship in any order.

## Out of scope

- Write/mutation admin endpoints (deferred)
- Admin audit log table (deferred until write actions exist)
- Multi-admin RBAC with scoped roles (premature for solo pre-launch)
- Polished admin UX (plain tables are sufficient; this is a two-user audience)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Founder's Supabase user has app_metadata.role = 'admin' claim set (manual SQL)
- [ ] #2 Proxy returns 403 for any /admin/* request whose JWT lacks the admin claim
- [ ] #3 SPA hides the /admin route from sidebar nav for non-admin users
- [ ] #4 All four read-only views (actors, workspaces, billing, webhooks) are reachable from /admin
- [ ] #5 workspace_memberships.role CHECK constraint remains unchanged (still 'owner' only)
- [ ] #6 No write/mutation admin endpoints exist in the proxy
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
