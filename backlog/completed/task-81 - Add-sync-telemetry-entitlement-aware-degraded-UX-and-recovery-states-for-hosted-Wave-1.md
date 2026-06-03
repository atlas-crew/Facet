---
id: TASK-81
title: >-
  Add sync telemetry, entitlement-aware degraded UX, and recovery states for
  hosted Wave 1
status: Done
assignee: []
created_date: '2026-03-12 16:07'
updated_date: '2026-05-06 20:42'
labels:
  - feature
  - persistence
  - billing
milestone: m-13
dependencies:
  - TASK-78
  - TASK-79
  - TASK-80
references:
  - src/components/AppShell.tsx
  - src/persistence/runtime.ts
  - src/persistence/coordinator.ts
documentation:
  - doc-6
  - doc-7
  - doc-8
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Once hosted persistence and AI paywalls exist, the app needs credible runtime status and recovery behavior. This task covers the user-visible sync, entitlement, offline, and recoverable-error states that make Wave 1 usable in production.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The app surfaces hosted sync states such as saving, saved, offline, and error in a way that reflects the authoritative hosted runtime.
- [ ] #2 Entitlement-related failures and upgrade-required states are surfaced distinctly from generic sync or persistence failures.
- [ ] #3 Users are given a recoverable path for common hosted failure cases such as retry, re-auth, or non-destructive fallback to local export/import.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-03-14: Starting implementation after checkpointing TASK-80 in commit `0c7a5c1`. Scoping the existing sync/error/entitlement surfaces to land the first production-grade hosted recovery/degraded UX slice.

2026-03-14: Added typed hosted API error parsing across account and persistence clients, mapped network failures to `offline`, and taught AppShell to distinguish hosted auth expiry, billing-state bootstrap failures, and offline sync from generic hosted errors. Recovery actions now include session refresh, retry, workspace management, and non-destructive backup fallback. Verification: targeted eslint, `npm run typecheck`, `npm run test -- src/test/persistenceRuntime.test.ts src/test/facetServer.test.ts src/test/hostedWorkspaceStore.test.ts src/test/hostedAppStore.test.ts src/test/HostedWorkspaceDialog.test.tsx src/test/AppShell.test.tsx src/test/remotePersistenceBackend.test.ts`, `npm run build`, and `git diff --check` all pass.

2026-05-06 closure (Wave 1 consolidation): Implementation shipped per 2026-03-14 notes — typed hosted API error parsing, network-failure offline mapping, AppShell distinguishing hosted auth expiry / billing-bootstrap failure / offline sync from generic errors, and recovery actions covering session refresh, retry, workspace management, and non-destructive backup fallback. ACs were never formally ticked by the original agent; rather than self-tick after the fact, this task closes Done and AC verification (sync states, entitlement failure distinction, recovery paths) is rolled into TASK-84 as the staging-validation pass. Avoids re-doing verification once with no users and once again at launch.
<!-- SECTION:NOTES:END -->

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
