---
id: TASK-102.8
title: Retire SearchProfile as independent durable truth
status: Done
assignee: []
created_date: '2026-04-11 06:14'
updated_date: '2026-04-12 01:36'
labels:
  - refactor
  - identity
  - research
milestone: m-16
dependencies:
  - TASK-102.2
  - TASK-102.7
references:
  - src/store/searchStore.ts
  - src/routes/research/ResearchPage.tsx
  - src/store/identityStore.ts
parent_task_id: TASK-102
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After the identity-first path is proven, reduce SearchProfile to a session or run configuration instead of a second long-lived source of truth. Persist only what is truly request- or run-specific and regenerate the rest from identity on demand.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 SearchProfile no longer stores identity-derived data as an independent durable truth once the identity-first path is active.
- [ ] #2 Only request-specific or run-specific search state remains durable outside identity.
- [ ] #3 Migration or normalization preserves existing user state without corrupting research runs.
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
