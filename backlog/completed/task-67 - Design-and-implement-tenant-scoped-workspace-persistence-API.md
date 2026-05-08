---
id: TASK-67
title: Design and implement tenant-scoped workspace persistence API
status: Done
assignee:
  - '@codex'
created_date: '2026-03-11 17:40'
updated_date: '2026-03-11 22:28'
labels:
  - feature
  - backend
  - persistence
milestone: m-11
dependencies:
  - TASK-65
  - TASK-66
references:
  - proxy/server.js
documentation:
  - 'backlog://document/doc-5'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend the app beyond browser-only persistence by introducing an authenticated backend contract for tenant-, user-, and workspace-scoped durable storage. This should establish the minimum viable server authority for workspace snapshots or artifact records without trying to solve real-time collaboration yet.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A server-side API contract is defined for authenticated workspace load/save flows with tenant-scoped authorization rules.
- [x] #2 Requests are validated against tenant and workspace membership server-side rather than trusting client-supplied scope values.
- [x] #3 The backend assigns authoritative revision and timestamp metadata for durable records or workspace snapshots.
- [x] #4 The design explicitly states how local-only mode and authenticated mode share the same client persistence interface.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verification:
- `npm run typecheck`
- `npx vitest run src/test/persistence.test.ts src/test/remotePersistenceBackend.test.ts src/test/facetServer.test.ts`
- `npx eslint src/persistence src/types/proxy-modules.d.ts src/test/persistence.test.ts src/test/remotePersistenceBackend.test.ts src/test/facetServer.test.ts src/test/fixtures/workspaceSnapshot.ts proxy/server.js proxy/facetServer.js proxy/persistenceApi.js`
- `npm run build`

Review loop:
- Full specialist review rerun on a generated diff that included untracked files to avoid false negatives from `--git` scope handling.
- Remediated the only substantive finding by extracting and documenting shared workspace snapshot test fixtures.

Open follow-up:
- Docs-architect approval and formatting checkbox remain open.
- Additional persistence edge-case coverage remains tracked in `TASK-70`.

Implemented tenant-scoped persistence API in `proxy/persistenceApi.js` and extracted a testable proxy factory in `proxy/facetServer.js`, then wired the client through `src/persistence/remoteBackend.ts` so local and authenticated modes share the `PersistenceBackend` contract.

Server now enforces bearer-token workspace membership, rewrites tenant/user/workspace identity server-side, and returns authoritative workspace/artifact revisions plus timestamps on save.

Claude review artifacts: `.agents/reviews/review-20260311-181624.md` (full diff with untracked files included), `.agents/reviews/review-20260311-182236.md`, `.agents/reviews/review-20260311-182513.md`. Early artifacts `.agents/reviews/review-20260311-181216.md` and `.agents/reviews/test-audit-20260311-181216.md` were stale/incomplete because untracked files were not present in the initial scoped diff.

Test audit artifacts: `.agents/reviews/test-audit-20260311-181216.md`, `.agents/reviews/test-audit-20260311-181403.md`, `.agents/reviews/test-audit-20260311-181452.md`. Remaining gaps are low-priority hardening/coverage candidates already captured in `TASK-70`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the first authenticated tenant-scoped workspace persistence API end to end. The proxy now exposes `GET/PUT /api/persistence/workspaces/:workspaceId` with proxy-key and bearer-token auth, server-side membership enforcement, and authoritative revision/timestamp rewriting. On the client, `createRemotePersistenceBackend()` plugs into the existing coordinator contract so local-only and authenticated persistence share the same interface. Documentation and regression coverage were added for the coordinator, remote backend, and live proxy integration paths.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Documentation has been created/modified/removed as needed.
- [ ] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [x] #4 Test changes were approved by a test gap analysis review
- [x] #5 Changes to integration points are covered by tests
- [x] #6 All tests pass successfully
- [ ] #7 Automatic formatting was applied.
- [x] #8 Linters report no WARNINGS or ERRORS
- [x] #9 The project builds successfully
<!-- DOD:END -->
