---
id: TASK-105
title: Expand identity-first strategy and store regression coverage
status: To Do
assignee: []
created_date: '2026-04-12 01:37'
labels:
  - tests
  - identity
  - research
dependencies: []
references:
  - src/store/identityStore.ts
  - src/routes/identity/IdentityPage.tsx
  - src/routes/research/ResearchPage.tsx
  - .agents/reviews/test-audit-20260411-213121.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the missing store and UI regression tests around identity strategy editing, ResearchPage transitions, and null-guarded update paths so identity-first editing remains stable as the workbench evolves.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Identity store tests cover updateCurrent* no-op behavior when currentIdentity is null and merge-mode applyDraft.
- [ ] #2 Identity and Research page tests cover strategy workbench rendering, keyboard navigation, and identity/resume transition behavior.
- [ ] #3 Regression tests cover remaining strategic editor paths not already exercised by the current m-16 suite.
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
