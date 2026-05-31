---
id: TASK-269
title: Fix Research Refresh from Identity no-op feedback
status: In Progress
assignee:
  - '@codex'
created_date: '2026-05-31 20:48'
updated_date: '2026-05-31 21:08'
labels:
  - bug
  - research
  - staleness
  - triage
dependencies: []
references:
  - TODO.md
  - backlog task-246
modified_files:
  - src/routes/research/ResearchPage.tsx
  - src/routes/research/stalenessRefreshHandlers.ts
  - src/test/ResearchPage.test.tsx
priority: high
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TODO reports that Research "Refresh from identity" does not seem to do anything. Related shipped work exists in TASK-246 for stale search-run refresh, so treat this as a bug/regression investigation rather than a missing-feature request.

Initial triage: Research has staleness refresh handlers for thesis, search runs, prep decks, and cover letters. The bug may be one of: the affordance is disabled/gated unexpectedly, the action completes but produces no visible notice/update, stale review context is invalidated before dispatch, or a specific artifact type does not persist the regenerated result.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Reproduce the reported no-op path from the current Research UI and identify the artifact type affected.
- [ ] #2 Refresh from Identity either regenerates/persists the selected stale artifact or shows a specific blocking reason.
- [ ] #3 User-visible feedback is emitted for start, success, cancel, drift, and failure paths.
- [ ] #4 Regression coverage protects the failing path.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Use systematic debugging: reproduce the exact no-op path in Research before changing code.
2. Compare the affected artifact path against the shipped TASK-246 refresh paths and the extracted stalenessRefreshHandlers.
3. Add or update a failing ResearchPage test for the path that currently appears inert.
4. Fix the smallest root cause, preserving identity-drift guards and cost confirmation semantics for search runs.
5. Verify with the focused ResearchPage test, typecheck, lint, and a browser smoke if the bug is UI-only.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Regression tests pass (scoped to touched files)
- [ ] #5 Linters report no warnings or errors in touched files
- [ ] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
