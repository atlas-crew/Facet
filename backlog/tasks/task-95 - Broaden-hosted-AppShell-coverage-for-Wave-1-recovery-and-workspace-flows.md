---
id: TASK-95
title: Broaden hosted AppShell coverage for Wave 1 recovery and workspace flows
status: In Progress
assignee:
  - '@worker-c'
created_date: '2026-04-08 08:28'
updated_date: '2026-05-10 00:22'
labels:
  - test
  - hosted
  - wave-1
milestone: m-13
dependencies: []
references:
  - ./.agents/reviews/test-audit-20260408-042346.md
  - ./src/components/AppShell.tsx
  - ./src/test/AppShell.test.tsx
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Close the remaining hosted AppShell test-audit gaps deferred from the 2026-04-08 Wave 1 receipt refresh. Cover the retry bootstrap flow, normal workspace switching, local-mode rendering, start-fresh onboarding, error clearing after recovery, and loading-state UI so the hosted shell recovery contract has stronger release coverage.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Retry hosted bootstrap re-invokes bootstrap and clears the error path on success.
- [ ] #2 Normal workspace switching through the UI reinitializes the runtime for the selected workspace.
- [ ] #3 Local-mode AppShell rendering is covered and excludes hosted-only recovery controls.
- [ ] #4 Hosted onboarding covers the start-fresh path and recovery clears stale errors.
- [ ] #5 Bootstrap loading and non-ready sync states are covered by focused AppShell tests.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Worker C plan:
1. Inspect current AppShell tests and hosted shell behavior for TASK-95 acceptance gaps without changing production AppShell code.
2. Add focused AppShell tests for hosted retry recovery, workspace switching runtime reinitialization, local-mode rendering, start-fresh onboarding/error clearing, and bootstrap/sync loading states.
3. Run focused AppShell tests plus scoped lint/typecheck/build gates as appropriate.
4. Run the required test-audit review for the AppShell test diff, update TASK-95 AC/DoD/notes, and commit only Worker C files with cortex git commit.
<!-- SECTION:PLAN:END -->

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
