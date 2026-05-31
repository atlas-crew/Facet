---
id: TASK-268.3
title: Add run-all Identity inference control with progress meter
status: To Do
assignee: []
created_date: '2026-05-31 20:48'
labels:
  - feature
  - identity
  - inference
  - progress
dependencies: []
references:
  - TODO.md
modified_files:
  - src/routes/identity/IdentityMapPage.tsx
  - src/store/identityStore.ts
  - src/utils/identityExtraction.ts
parent_task_id: TASK-268
priority: medium
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TODO requests a single Identity action that runs all inference steps with a progress meter showing completed, current, and remaining work. The requested sequence includes Thesis, Chapters, Search Vectors, Search Strategy, Open Questions, Bullet Deepening, and Skill Deepening.

Architecture note: this is candidate-only inference and belongs in Identity. It should orchestrate existing per-section generators/actions without hiding user review requirements. Wrong confident AI output is worse than blank fields, so outputs that affect durable identity need review/correction affordances.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Identity exposes one Run all inference action from the appropriate Identity surface.
- [ ] #2 The run shows an ordered step list with done/current/remaining/error states.
- [ ] #3 The orchestrator can skip already-complete steps or clearly explains why a step is unavailable.
- [ ] #4 Partial failures preserve successful completed steps and provide retry semantics.
- [ ] #5 Durable identity mutations are reviewable or clearly scoped to accepted inference outputs.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inventory existing Identity inference actions and their current state contracts.
2. Define a small orchestration state machine in Identity, preferably transient UI state unless persistence is required for long jobs.
3. Reuse existing generators/actions for each step instead of duplicating prompts.
4. Add progress rendering and cancellation/retry semantics.
5. Add tests for happy path, skipped steps, failure continuation, and cancellation.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Regression tests pass (scoped to touched files)
- [ ] #5 Linters report no warnings or errors in touched files
- [ ] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
