---
id: TASK-232
title: 'Phase 7: apply internal audience projection on Build assembly pipeline'
status: To Do
assignee: []
created_date: '2026-05-06 20:28'
labels:
  - audience-tagging
  - phase-7
  - build
milestone: m-28
dependencies: []
references:
  - src/utils/buildProjection.ts
  - src/utils/matchAssembler.ts
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

The Build workspace assembles resumes from JDAnalysis + identity. Build artifacts are internal (used to construct outputs that go to recruiters/HMs separately). Currently `buildProjection.ts` reads all content via `notesText()` without audience filtering.

## What

- Apply `projectForAudience(jd, 'internal')` in `src/utils/buildProjection.ts` before extracting content
- Confirm internal-tagged content (filter triggers, watch-outs at hard severity) reaches Build correctly
- Verify candidate-only content (positioning recommendations, etc.) does *not* leak into Build assembly unintentionally
- Update tests with production-shaped fixtures

## Acceptance criteria

- buildProjection applies internal audience filter
- Resume assembly still produces equivalent outputs for the happy path
- Tests use production-shaped audience fixtures
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
