---
id: TASK-233
title: Apply candidate audience filtering to Match and Pipeline JD analysis render
status: In Progress
assignee:
  - '@codex'
created_date: '2026-05-06 20:28'
updated_date: '2026-05-26 06:06'
labels:
  - audience-tagging
  - render
  - match
  - pipeline
milestone: m-28
dependencies: []
references:
  - src/routes/match/MatchPage.tsx
  - src/routes/pipeline/PipelineJDAnalysisPanel.tsx
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

The MatchPage renders all warnings, all gap-focus, all positioning recommendations directly from `currentJDAnalysis`/`currentReport`. PipelineJDAnalysisPanel does the same. The page is for the candidate, so internal-only warnings (e.g., data-quality flags) and HM-only items shouldn't render. Currently they do.

## What

- Wrap render-time access in `projectForAudience(currentJDAnalysis, 'candidate')` in `MatchPage.tsx` and `PipelineJDAnalysisPanel.tsx`
- Verify candidate sees: positioning notes, gap focus, candidate-tagged advantages/skills
- Verify candidate does *not* see: internal warnings, recruiter-only hooks
- Add tests pinning what the candidate audience sees

## Acceptance criteria

- Page-level rendering goes through audience projection
- Tests assert filtering behavior on a known fixture
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-05-26 Codex starting TASK-233. Placement: candidate-facing render projection only; no JDAnalysis ownership/schema changes. Plan: inspect projectForAudience and current Match/Pipeline render paths, apply candidate projection at render boundary, add focused tests for candidate-visible vs filtered audience-tagged notes, run focused gates, independent review/audit, commit/close.
<!-- SECTION:NOTES:END -->
