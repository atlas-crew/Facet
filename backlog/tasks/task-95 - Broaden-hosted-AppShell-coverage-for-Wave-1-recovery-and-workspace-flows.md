---
id: TASK-95
title: Broaden hosted AppShell coverage for Wave 1 recovery and workspace flows
status: In Progress
assignee:
  - '@worker-c'
created_date: '2026-04-08 08:28'
updated_date: '2026-05-10 00:40'
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
modified_files:
  - src/test/AppShell.test.tsx
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Close the remaining hosted AppShell test-audit gaps deferred from the 2026-04-08 Wave 1 receipt refresh. Cover the retry bootstrap flow, normal workspace switching, local-mode rendering, start-fresh onboarding, error clearing after recovery, and loading-state UI so the hosted shell recovery contract has stronger release coverage.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Retry hosted bootstrap re-invokes bootstrap and clears the error path on success.
- [x] #2 Normal workspace switching through the UI reinitializes the runtime for the selected workspace.
- [x] #3 Local-mode AppShell rendering is covered and excludes hosted-only recovery controls.
- [x] #4 Hosted onboarding covers the start-fresh path and recovery clears stale errors.
- [x] #5 Bootstrap loading and non-ready sync states are covered by focused AppShell tests.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Worker C plan:
1. Inspect current AppShell tests and hosted shell behavior for TASK-95 acceptance gaps without changing production AppShell code.
2. Add focused AppShell tests for hosted retry recovery, workspace switching runtime reinitialization, local-mode rendering, start-fresh onboarding/error clearing, and bootstrap/sync loading states.
3. Run focused AppShell tests plus scoped lint/typecheck/build gates as appropriate.
4. Run the required test-audit review for the AppShell test diff, update TASK-95 AC/DoD/notes, and commit only Worker C files with cortex git commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Worker C AppShell coverage update:
- Added focused AppShell tests for hosted bootstrap retry success/error clearing, hosted workspace switching through the dialog, local-mode exclusion of hosted recovery controls, start-fresh onboarding recovery, bootstrap loading, non-ready/ready sync labels, stale selected workspace fallback, system theme media-query changes, and cross-tab identity storage edge cases.
- Focused verification passed: npx vitest run src/test/AppShell.test.tsx (50 tests), pnpm exec eslint src/test/AppShell.test.tsx, pnpm format:files src/test/AppShell.test.tsx, git diff --check scoped to AppShell.
- Test audit receipt: .agents/reviews/test-audit-20260509-203820.md. P0=0; residual P1/P2 gaps are broader lifecycle/workspace rename-delete coverage outside TASK-95 Wave 1 recovery acceptance.
- Repo-wide typecheck/build currently blocked by parallel billing-pass migration fixture drift in src/test/aiAccess.test.ts and src/test/hostedAppStore.test.ts; AppShell fixture was updated to the current billingPass shape inside this owned test file only.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Documentation has been created/modified/removed as needed.
- [ ] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [ ] #4 Test changes were approved by a test gap analysis review
- [x] #5 Changes to integration points are covered by tests
- [ ] #6 All tests pass successfully
- [x] #7 Automatic formatting was applied.
- [ ] #8 Linters report no WARNINGS or ERRORS
- [ ] #9 The project builds successfully
<!-- DOD:END -->
