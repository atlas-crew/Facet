---
id: TASK-79
title: >-
  Replace the dev persistence shim with a durable hosted workspace backend and
  directory APIs
status: Done
assignee:
  - codex
created_date: '2026-03-12 16:07'
updated_date: '2026-03-14 04:00'
labels:
  - feature
  - persistence
  - auth
milestone: m-12
dependencies:
  - TASK-75
  - TASK-76
  - TASK-85
references:
  - src/persistence/README.md
  - proxy/persistenceApi.js
  - src/persistence/coordinator.ts
documentation:
  - doc-5
  - doc-6
  - doc-7
  - doc-9
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Move Wave 1 hosted persistence off the current in-memory/dev-token path and onto durable server-backed storage with explicit workspace directory operations. This is the production data-plane half of hosted accounts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Hosted workspaces are stored durably outside process memory and served through authoritative server persistence.
- [x] #2 Workspace list/create/rename/delete APIs exist with server-side ownership and membership checks.
- [x] #3 The hosted persistence path assigns authoritative revision and timestamp metadata server-side and no longer behaves like a local-dev shim.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a hosted workspace store abstraction that can serve both actor membership and durable workspace persistence.
2. Expand the persistence API with hosted workspace directory routes for list/create/rename/delete while preserving server-authored snapshot metadata.
3. Wire hosted mode to the new store, extend hosted account/client types, and document the updated contract.
4. Verify with targeted Vitest coverage plus typecheck/build on the touched slice.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-03-14: Implemented durable hosted workspace store plus collection/item persistence routes. Hosted mode now uses a unified actor+workspace store for auth bootstrap and authoritative workspace persistence.
Verification: npm run test -- src/test/facetServer.test.ts src/test/hostedWorkspaceStore.test.ts; npm run typecheck; npx eslint proxy/hostedWorkspaceStore.js proxy/hostedAuth.js proxy/persistenceApi.js proxy/facetServer.js proxy/server.js src/utils/hostedAccountClient.ts src/types/hosted.ts src/types/proxy-modules.d.ts src/test/facetServer.test.ts src/test/hostedWorkspaceStore.test.ts; npm run build; git diff --check.
Review artifacts: .agents/reviews/review-20260313-221928.md (PASS WITH ISSUES); .agents/reviews/test-audit-20260313-222207.md (follow-up gaps captured in TASK-79.1).

2026-03-14: Closed TASK-79.1 hardening ACs with atomic file writes, same-process write serialization, stricter direct-store validation, and expanded hostedWorkspaceStore regressions. Remaining audit-only depth coverage moved to a follow-up task so the main hosted persistence slice no longer depends on it.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced hosted in-memory persistence with a durable hosted workspace store for local hosted mode, added server-owned workspace directory CRUD APIs, kept server-authored revision/timestamp metadata on snapshot saves, and extended hosted client/docs/test coverage around the new contract. Follow-up TASK-79.1 tracks remaining store-hardening test debt from the independent audit.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Documentation has been created/modified/removed as needed.
- [ ] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [ ] #4 Test changes were approved by a test gap analysis review
- [ ] #5 Changes to integration points are covered by tests
- [ ] #6 All tests pass successfully
- [ ] #7 Automatic formatting was applied.
- [ ] #8 Linters report no WARNINGS or ERRORS
- [ ] #9 The project builds successfully
<!-- DOD:END -->
