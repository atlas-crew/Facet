---
id: TASK-199
title: 'Phase D: Remove focusVectors from SearchRequest and finalize lanes-only'
status: To Do
assignee: []
created_date: '2026-04-30 08:26'
labels:
  - search
  - research
  - architecture
  - lanes-migration
  - phase-d
  - cleanup
dependencies:
  - TASK-197
  - TASK-198
references:
  - src/types/search.ts
  - src/persistence/validation.ts
  - src/utils/deepSearchClient.ts
  - proxy/researchJobs.js
  - >-
    backlog/docs/doc-24 -
    Search-Workspace-Redesign-—-Search-Thesis-Semantic-Depth-Feedback-Loop.md
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Final phase of the search angle migration. Depends on Phases B and C.

## Context

After Phase C, `profile.vectors` is gone but `SearchRequest.focusVectors: string[]` still hangs around for snapshot back-compat. This phase removes it entirely so the request shape reflects the new lanes-only architecture.

## Required scope

1. **Remove `focusVectors: string[]`** from `SearchRequest` in `src/types/search.ts`.
2. **Remove `focusVectors`** from any persisted snapshot validation in `src/persistence/validation.ts`.
3. **Update workspace snapshot migration** to strip the field from old snapshots cleanly — additive-optional drop pattern (loader tolerates presence, discards on read).
4. **Update `createDeepResearchJob`** request shape and the proxy / runner side to remove the field.
5. **Update `ResearchJob.params`** snapshot type to remove the field.
6. **Update doc-24** so the design doc reflects lanes as the only angle abstraction; remove resume-vector references.
7. **Sweep tests/fixtures** for any remaining `focusVectors` references; remove or migrate to `focusLanes`.

## Acceptance Criteria

- Zero references to `focusVectors` in `src/` and `proxy/` (verified via grep)
- All tests pass
- Workspace snapshots from any prior phase load without errors (focusVectors silently dropped)
- doc-24 accurately reflects the lanes-only architecture; references to "resume vectors" or "focus vectors" updated or removed
- Bonus: a small note in CHANGELOG / migration doc summarizing the four-phase migration for future archaeology

## Out of scope

- `ResumeData.vectors` in the Build workspace — those are independent of search and stay as-is.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
