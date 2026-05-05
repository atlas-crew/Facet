---
id: TASK-208.3
title: Pass canonical JDAnalysis projection into pure Prep generation
status: To Do
assignee: []
created_date: '2026-05-05 16:23'
labels:
  - refactor
  - prep
  - canonical-projections
dependencies:
  - TASK-208.1
  - TASK-208.2
references:
  - src/routes/prep/PrepPage.tsx
  - src/utils/prepGenerator.ts
  - src/utils/jdAnalysis.ts
  - src/store/jdAnalysisStore.ts
  - src/routes/letters/LettersPage.tsx
documentation:
  - docs/architecture/facet-workspace-topology.md
  - docs/development/refactors/2026-04-jd-analysis-consolidation.md
parent_task_id: TASK-208
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Lock decision: keep prepGenerator pure. Store resolution belongs in PrepPage or a small generation-context helper; prepGenerator receives structured JDAnalysis input and no longer re-infers analysis from raw JD text.

This is the main Workstream 2 implementation slice: resolve PipelineEntry + JDAnalysis + drift, block missing/stale analysis, pass canonical analysis into the generator, and update prompts/tests so stack alignment, gap framing, landmines, positioning, and watch-outs are projected from JDAnalysis instead of rediscovered from raw JD.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Prep generation resolves the linked Pipeline entry JDAnalysis and blocks generation when it is missing or stale.
- [ ] #2 prepGenerator accepts structured JDAnalysis input and does not import Zustand stores.
- [ ] #3 Prompt/input contract uses JDAnalysis fields for requirements, skill matches, strengths, gaps, watch-outs, positioning, and evidence mapping.
- [ ] #4 Raw JD text is retained only as source/snapshot context, not as the analysis source for generation.
- [ ] #5 Tests validate that Prep no longer re-infers JD analysis from raw JD text.
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
