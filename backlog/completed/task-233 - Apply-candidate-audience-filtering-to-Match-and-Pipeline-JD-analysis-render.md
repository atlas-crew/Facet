---
id: TASK-233
title: Apply candidate audience filtering to Match and Pipeline JD analysis render
status: Done
assignee:
  - '@codex'
created_date: '2026-05-06 20:28'
updated_date: '2026-05-26 06:30'
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
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-05-26 Codex starting TASK-233. Placement: candidate-facing render projection only; no JDAnalysis ownership/schema changes. Plan: inspect projectForAudience and current Match/Pipeline render paths, apply candidate projection at render boundary, add focused tests for candidate-visible vs filtered audience-tagged notes, run focused gates, independent review/audit, commit/close.

2026-05-26 Codex completed TASK-233 implementation. Candidate render projection now wraps MatchPage and PipelineJDAnalysisPanel surfaces; export, Pipeline summary strings, and Build handoff consume candidate-projected views while the canonical JDAnalysis artifact remains unprojected when saved.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented candidate-audience projection for Match and Pipeline JD analysis rendering. MatchPage now derives candidate-projected JD analysis/report views for rendering, export, Pipeline entry summary fields, and Build handoff. PipelineJDAnalysisPanel projects saved analysis before display. Added regression coverage for candidate-visible/hidden fields, export payloads, Build handoff, Pipeline entry summaries, canonical saved artifacts, filtered skill behavior, and Pipeline page fixtures. Verification: format:files, typecheck, focused Match/Pipeline tests, PipelinePage test, lint, build, independent source review CLEAN, diff test audit no gaps.
<!-- SECTION:FINAL_SUMMARY:END -->
