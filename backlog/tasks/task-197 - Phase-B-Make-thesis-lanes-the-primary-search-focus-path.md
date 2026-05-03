---
id: TASK-197
title: 'Phase B: Make thesis lanes the primary search-focus path'
status: To Do
assignee: []
created_date: '2026-04-30 08:26'
labels:
  - search
  - research
  - architecture
  - lanes-migration
  - phase-b
dependencies: []
references:
  - src/types/search.ts
  - src/utils/deepSearchClient.ts
  - src/routes/research/ResearchPage.tsx
  - src/routes/research/researchUtils.ts
  - >-
    backlog/docs/doc-24 -
    Search-Workspace-Redesign-—-Search-Thesis-Semantic-Depth-Feedback-Loop.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Phase B of the search angle migration (parent: see "Replace resume vectors with thesis lanes as the search-angle abstraction" thread).

## Context

Phase A (separate task) adds `focusLanes` alongside the existing `focusVectors` so both work in parallel. Phase B promotes lanes to the primary path and removes resume-only escape hatches.

## Required scope

1. **Make Generate Thesis a hard prerequisite for Run Search.** Today the launch path will accept `focusVectors` from a resume-derived profile even with no thesis. After Phase B, Launch is gated on `activeThesis !== null`. Identity is already mandatory upstream (resume generation requires it), so the resume-only fallback path is dead weight.

2. **Drop the deterministic-fallback-thesis path** referenced in `doc-24:391-396`. Resume-backed search no longer launches without a generated thesis. Remove the fallback construction code in the deep-research runner / `createDeepResearchJob` if it exists.

3. **Lane checkboxes become the canonical focus picker.** When active thesis exists, lane checkboxes are shown; resume-vector checkboxes hide. Verify Phase A's parallel UI is collapsed cleanly to lanes-only.

4. **Update copy** on the Search Launcher empty state to direct users at "Generate Thesis" rather than at vector picking.

## Acceptance Criteria

- Run Search button is disabled and clearly labeled when `activeThesis === null` (e.g. "Generate a thesis to launch search")
- Search Launcher UI no longer renders the legacy `focusVectors` picker — only lane checkboxes
- `createDeepResearchJob` rejects requests without `focusLanes` populated
- Resume-only fallback thesis construction code is removed from `searchExecutor` / runner
- Tests: existing tests covering the resume-only path either updated to use a thesis or removed; new test asserts launch is blocked without active thesis

## Out of scope

- Removing `focusVectors` field from `SearchRequest` — defer to Phase D (cleanup) so persisted snapshots still round-trip during the transition.
- Removing `profile.vectors` — Phase C.
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
