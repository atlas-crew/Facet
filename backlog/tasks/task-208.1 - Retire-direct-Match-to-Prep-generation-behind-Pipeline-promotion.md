---
id: TASK-208.1
title: Retire direct Match-to-Prep generation behind Pipeline promotion
status: To Do
assignee: []
created_date: '2026-05-05 16:22'
labels:
  - refactor
  - prep
  - canonical-projections
dependencies: []
references:
  - src/routes/prep/PrepPage.tsx
  - src/store/matchStore.ts
documentation:
  - docs/architecture/facet-workspace-topology.md
parent_task_id: TASK-208
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Lock decision: job-specific Prep generation must launch from Pipeline-owned application context. Direct Match-to-Prep generation creates Prep decks without a durable pipeline entry, which conflicts with the topology now used by Build and Letters.

Scope this to removing or disabling the direct Match source path in Prep, replacing it with a promote/create Pipeline entry affordance, and preserving non-job-specific blank/manual deck flows.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Prep no longer creates AI-generated job-specific decks from Match state without a pipeline entry.
- [ ] #2 When Match context exists, Prep surfaces a promote/create Pipeline entry path instead of Generate with AI.
- [ ] #3 Manual/blank Prep deck creation remains available and does not require a pipeline entry.
- [ ] #4 Tests cover the retired Match generation path and the Pipeline-required helper state.
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
