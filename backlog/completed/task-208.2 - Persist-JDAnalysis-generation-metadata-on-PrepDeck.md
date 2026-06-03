---
id: TASK-208.2
title: Persist JDAnalysis generation metadata on PrepDeck
status: Done
assignee: []
created_date: '2026-05-05 16:23'
updated_date: '2026-05-05 22:51'
labels:
  - refactor
  - prep
  - canonical-projections
dependencies: []
references:
  - src/types/prep.ts
  - src/store/prepStore.ts
  - src/utils/prepImport.ts
  - src/types/jdAnalysis.ts
documentation:
  - docs/architecture/facet-workspace-topology.md
parent_task_id: TASK-208
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Lock decision: PrepDeck should store the JDAnalysis identity used at generation time, not just the pipeline entry. This gives Prep enough information to explain stale states when Pipeline points to a newer analysis, the analysis model changes, or the JD text changes.

Recommended fields: jdAnalysisId, jdAnalysisGeneratedAt, jdAnalysisModelVersion, jdTextHash. Keep migration simple; Facet is pre-launch and stale legacy decks can be treated as needing regeneration.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 PrepDeck includes canonical JDAnalysis generation metadata fields.
- [x] #2 Prep store sanitization, export, import, and persistence migration preserve/sanitize the metadata.
- [x] #3 Generated Pipeline-linked Prep decks write metadata from the JDAnalysis used for generation.
- [x] #4 Tests cover metadata persistence and malformed import normalization.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Data-model slice only: (1) audit PrepDeck type, store sanitization, export/import, workspace persistence validation, and tests; (2) add jdAnalysisId, jdAnalysisGeneratedAt, jdAnalysisModelVersion, jdTextHash to PrepDeck/CreateDeckInput with safe string/null normalization; (3) preserve metadata through store create/update/export/import/persistence migration; (4) add focused tests; (5) run typecheck, focused tests, lint, build, independent review/audit, then close. No prepGenerator prompt rewrite and no Match-to-Prep retirement in this task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Data-model slice complete: PrepDeck/CreateDeckInput now carry jdAnalysisId, jdAnalysisGeneratedAt, jdAnalysisModelVersion, and jdTextHash; store create/migrate/export/import and JSON import normalize metadata. AC #3's generator-supplied write-through is structurally unblocked here and will be exercised when TASK-208.3 resolves/passes canonical JDAnalysis into generation.

Closeout verification (2026-05-05): AC #3 is satisfied by the shipped TASK-208.3 generator/page integration. Evidence: prepGenerator writes jdAnalysisId, jdAnalysisGeneratedAt, jdAnalysisModelVersion, and jdTextHash from request.jdAnalysis into generated decks; PrepPage stamps the same fields for Pipeline-linked create/update/relink paths. Focused verification: pnpm vitest run src/test/prepGenerator.test.ts src/test/prepStore.test.ts src/test/prepImport.test.ts src/test/PrepPage.identityGeneration.test.tsx src/test/PrepPage.test.tsx — 5 files, 68 tests passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
PrepDeck now persists canonical JDAnalysis metadata end to end. The schema/store/import/export slice landed first, and the subsequent canonical generator/page integration now writes the metadata from the JDAnalysis used for Pipeline-linked prep generation and regeneration. Focused Prep/JDAnalysis tests pass.
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
