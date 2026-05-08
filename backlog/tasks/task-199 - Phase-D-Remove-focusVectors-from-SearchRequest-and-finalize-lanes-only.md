---
id: TASK-199
title: 'Phase D: Remove focusVectors from SearchRequest and finalize lanes-only'
status: Done
assignee:
  - '@codex'
created_date: '2026-04-30 08:26'
updated_date: '2026-05-08 00:47'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Remove SearchRequest.focusVectors after Phase C: delete the type/input/hydration defaults, strip legacy focusVectors while loading persisted requests/jobs, update client/proxy/deep-research request paths and fixtures to rely on focusLanes only, update doc-24, then run focused tests/typecheck/review and commit the scoped slice.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed SearchRequest.focusVectors from source, proxy, tests, and doc-24. Store hydration and proxy request normalization now strip retired/unknown request fields, enforce lanes-only job params, preserve draft-safe defaults, and cover legacy/persistence/proxy normalization behavior. Validation: rg focusVectors src proxy clean; focused Vitest 8 files/252 tests passed; eslint passed; format check passed; npm run typecheck passed; npm run build passed; specialist/test-audit loops completed with no P0 failures and remaining recurring findings are follow-up hardening/P2-P3 cleanup outside this Phase-D closure.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
