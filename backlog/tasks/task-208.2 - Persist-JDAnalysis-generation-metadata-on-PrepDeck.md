---
id: TASK-208.2
title: Persist JDAnalysis generation metadata on PrepDeck
status: To Do
assignee: []
created_date: '2026-05-05 16:23'
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
- [ ] #1 PrepDeck includes canonical JDAnalysis generation metadata fields.
- [ ] #2 Prep store sanitization, export, import, and persistence migration preserve/sanitize the metadata.
- [ ] #3 Generated Pipeline-linked Prep decks write metadata from the JDAnalysis used for generation.
- [ ] #4 Tests cover metadata persistence and malformed import normalization.
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
