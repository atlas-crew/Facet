---
id: TASK-196
title: >-
  Complete search parameters surface (hard constraints + per-search filter
  toggles)
status: To Do
assignee: []
created_date: '2026-04-29 08:40'
labels:
  - search-redesign
  - identity-model
dependencies: []
references:
  - src/types/search.ts
  - src/store/searchStore.ts
  - src/identity/schema.ts
  - src/utils/identitySearchProfile.ts
  - src/routes/research/searchWorkspaceComponents.tsx
  - src/routes/identity/IdentityStrategyWorkbench.tsx
documentation:
  - backlog doc-24 (Search Workspace Redesign)
  - backlog doc-34 (Search Parameters Surface — Design)
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Research workspace's search-parameter surface is missing hard constraints (industries to avoid, funding stages, remote policies, employment types, salary band) and per-search filter toggles (enable/disable individual prioritize/avoid items per search instance without mutating the master list).

Per the architecture established in doc-24 (Search Workspace Redesign), durable self-knowledge lives in the identity model and is mirrored into the search snapshot; per-search overrides live in the search instance only.

This parent task tracks the five subtasks that complete this surface end-to-end:
- .1 — Bank enums + identity preference fields (industries / funding / employment / surface remote)
- .2 — Restructure compensation as structured `SalaryBand`
- .3 — Add stable id to filter entries + per-search `disabledFilterIds` override (depends on TASK-165)
- .4 — Hard-constraints UI in `SearchInstancePreferences`
- .5 — Per-item filter toggle UI in `SearchInstancePreferences`

Subtasks .1 and .2 can run in parallel. .3 waits on TASK-165. .4 and .5 are UI work and run last in parallel after their schema dependencies land.

Design decisions, bank members, migration logic, and override semantics are documented in backlog doc-34. Subtasks should reference it and not re-derive.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All five subtasks completed and merged
- [ ] #2 User can edit hard constraints (industries, funding, remote, employment, salary, clearance) in SearchInstancePreferences and have edits persist
- [ ] #3 User can disable individual prioritize/avoid filters for a single search without affecting the master list
- [ ] #4 Master list edits in IdentityStrategyWorkbench correctly propagate to search snapshots via the existing adapter pattern
- [ ] #5 Migration handles existing persisted state without data loss
- [ ] #6 No raw enum values appear in the UI — all bank values render with display labels
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
