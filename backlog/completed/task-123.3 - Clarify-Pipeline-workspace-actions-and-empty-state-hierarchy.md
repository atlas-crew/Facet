---
id: TASK-123.3
title: Clarify Pipeline workspace actions and empty-state hierarchy
status: Done
assignee:
  - codex
created_date: '2026-04-14 12:41'
updated_date: '2026-04-14 14:22'
labels:
  - ux
  - pipeline
  - workspace-shell
dependencies: []
references:
  - src/routes/pipeline/PipelinePage.tsx
  - src/routes/pipeline/PipelineDetail.tsx
  - src/routes/pipeline/pipeline.css
parent_task_id: TASK-123
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Tighten the Pipeline workspace so the default path is obvious in both empty and populated states. The redesign should reduce competing primary actions, make research and execution actions easier to parse, and keep utility actions in a secondary role.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Pipeline header exposes one dominant primary action and a clearer secondary utility pattern.
- [x] #2 The Pipeline empty state recommends a single best starting path while still preserving alternative capture flows.
- [x] #3 Entry detail actions are grouped by intent so research, execution, and management actions are easier to scan.
- [x] #4 The redesigned workspace preserves existing pipeline functionality while making the main workflow easier to understand.
- [x] #5 Relevant tests and copy are updated, and the slice verifies with typecheck, targeted tests, and build.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Review the Pipeline header, empty state, detail actions, and focused route tests to find where multiple primary actions and mixed-intent controls are competing.
Refactor the Pipeline shell so the header has one dominant Add Entry action, the empty state recommends a single best start, and supporting capture/utilities are visually secondary.
Group detail actions by intent so research, execution, and management controls are easier to scan without disturbing investigation/build/prep behavior.
Update focused Pipeline tests and any affected copy assertions to match the new shell hierarchy.
Verify with npm run typecheck, targeted vitest for PipelinePage, targeted eslint on touched files, and npm run build before committing with cortex git commit.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Clarified the Pipeline workspace shell around one dominant Add Entry action and a clearer status-oriented header.
Reworked the empty state to recommend Add Entry first, demoted Paste JD to a secondary path, and moved sample/import into utilities.
Grouped Pipeline detail actions by Research, Execution, and Management intent, with improved accessibility semantics and status messaging.
Updated PipelinePage regression coverage for the new shell hierarchy and grouped detail actions.
Verification: npm run typecheck; npx vitest run src/test/PipelinePage.test.tsx; npx eslint --no-warn-ignored src/routes/pipeline/PipelinePage.tsx src/routes/pipeline/PipelineDetail.tsx src/routes/pipeline/pipeline.css src/test/PipelinePage.test.tsx; npm run build.
Review artifacts: .agents/reviews/review-20260414-101420.md, .agents/reviews/review-20260414-101802.md, .agents/reviews/test-audit-20260414-101423.md. Broader PipelinePage filter/sort/loading coverage remains tracked separately in TASK-121.3.
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
