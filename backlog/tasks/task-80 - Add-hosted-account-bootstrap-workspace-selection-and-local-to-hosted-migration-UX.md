---
id: TASK-80
title: >-
  Add hosted account bootstrap, workspace selection, and local-to-hosted
  migration UX
status: Done
assignee: []
created_date: '2026-03-12 16:07'
updated_date: '2026-05-06 20:42'
labels:
  - feature
  - persistence
  - billing
milestone: m-12
dependencies:
  - TASK-76
  - TASK-79
documentation:
  - doc-6
  - doc-7
  - doc-8
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the client-side Wave 1 hosted experience on top of real auth and hosted persistence. This should cover account bootstrap, workspace directory selection, and the first-run path that helps local-only users migrate their existing workspace into a hosted account.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The client can bootstrap into hosted mode for an authenticated account and list/select hosted workspaces.
- [x] #2 Users can create, rename, and remove hosted workspaces through the client UX without dropping into raw API flows.
- [x] #3 A local-to-hosted migration or import path exists so a user can move existing local workspace data into their hosted account during Wave 1 onboarding.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-03-14: Implemented hosted client bootstrap, workspace directory management UX, local-to-hosted migration flow, and remote runtime swapping in the current worktree. Added AppShell integration coverage for hosted bootstrap/runtime handoff and migration import failure recovery, plus hostedAppStore recovery-path tests. Verification so far: targeted eslint, `npm run typecheck`, `npm run test -- src/test/persistenceRuntime.test.ts src/test/facetServer.test.ts src/test/hostedWorkspaceStore.test.ts src/test/hostedAppStore.test.ts src/test/HostedWorkspaceDialog.test.tsx src/test/AppShell.test.tsx`, `npm run build`, and `git diff --check` all pass. Pending: fresh independent review artifacts and final task closeout decision.

2026-03-14: Refreshed independent review now passes via `.agents/reviews/review-20260314-hosted-wave1-remediated-v2.md`. Refreshed test-gap audit originally flagged missing hostedAppStore rename/delete failure-path coverage; added those tests and reran verification (`64` hosted persistence/runtime tests passing in the focused Wave 1 pack). Remaining task-closeout question is backlog hygiene around docs-architect approval for the README update, not product-code correctness.

2026-05-06 closure (Wave 1 consolidation): All 3 ACs satisfied; hosted bootstrap, workspace directory management, and local-to-hosted migration shipped per 2026-03-14 verification (typecheck/test/build all passing on focused Wave 1 pack). DoD docs-architect approval and full-formatting items remain unchecked but are subsumed under TASK-84's launch-readiness gate. Wave 1 engineering tasks consolidated into TASK-84 as the single launch holder; this task closes.
<!-- SECTION:NOTES:END -->

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
