---
id: TASK-196.2
title: Restructure SearchProfileConstraints.compensation as SalaryBand min/max
status: Done
assignee:
  - '@myself'
created_date: '2026-04-29 08:41'
updated_date: '2026-05-08 08:12'
labels:
  - search-redesign
  - identity-model
dependencies: []
references:
  - src/types/search.ts
  - src/store/searchStore.ts
  - src/utils/identitySearchProfile.ts
  - src/test/searchStore.test.ts
  - src/test/ResearchPage.test.tsx
documentation:
  - backlog doc-34 (Search Parameters Surface — Design)
  - backlog doc-24 (Search Workspace Redesign)
parent_task_id: TASK-196
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`SearchProfileConstraints.compensation` is currently a free-form string (e.g. "$120k–$160k"). The corresponding identity field (`preferences.compensation.{base_floor, base_target}`) is structured numbers. The mismatch blocks the salary-slider UX in subtask .4 and forces lossy parsing on every read.

Replace with a structured `SalaryBand { min, max, currency? }` mirrored from identity at adapt time. Update the adapter to map identity numbers → SearchProfileConstraints structured shape. Update `searchStore.migrateSearchState` to convert legacy persisted strings to the new shape; on parse failure, fall back to `{ min: 0, max: 0 }` and emit a one-time warning.

Type definition, adapter mapping, and migration logic are specified in backlog doc-34 §3 and §6. This task is independent of subtask .1 and can run in parallel.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 SalaryBand type exported from src/types/search.ts (min: number, max: number, currency?: string)
- [x] #2 SearchProfileConstraints.compensation field removed; SearchProfileConstraints.salary: SalaryBand added in its place
- [x] #3 identitySearchProfile adapter maps identity.preferences.compensation.{base_floor, base_target} → SearchProfileConstraints.salary.{min, max}
- [x] #4 searchStore.migrateSearchState parses legacy compensation strings into structured form when possible; on parse failure, sets {min: 0, max: 0} and emits a one-time console.warn
- [x] #5 Migration is idempotent: running it twice on already-migrated state is a no-op
- [x] #6 All existing references to SearchProfileConstraints.compensation in code and tests are migrated to .salary
- [x] #7 Test fixtures in src/test/* updated to the new shape
- [x] #8 Build and existing test suite pass after migration
- [x] #9 New tests cover: parse of well-formed string ranges, fallback on malformed input, identity → search adapter round-trip
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Closed after SalaryBand lane verification. Implemented structured salary constraints, adapter mapping, legacy migration with one-time malformed warning, and salary read/write/display updates across search/thesis/research surfaces. Verification: npm run typecheck passed; npm run build passed with existing large-chunk warnings; worker-reported focused/affected Vitest and scoped ESLint passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced SearchProfileConstraints.compensation with structured salary bands, added legacy compensation parsing/fallback migration, mapped identity compensation preferences into SearchProfileConstraints.salary, and updated downstream search/thesis/research tests and fixtures. Verification: npm run typecheck passed; npm run build passed with existing chunk-size warnings; focused/affected test and lint lanes passed in worker verification.
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
