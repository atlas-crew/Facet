---
id: TASK-269
title: Fix Research Refresh from Identity no-op feedback
status: Done
assignee:
  - '@codex'
created_date: '2026-05-31 20:48'
updated_date: '2026-05-31 21:38'
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
- [x] #1 Reproduce the reported no-op path from the current Research UI and identify the artifact type affected.
- [x] #2 Refresh from Identity either regenerates/persists the selected stale artifact or shows a specific blocking reason.
- [x] #3 User-visible feedback is emitted for start, success, cancel, drift, and failure paths.
- [x] #4 Regression coverage protects the failing path.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Use systematic debugging: reproduce the exact no-op path in Research before changing code.
2. Compare the affected artifact path against the shipped TASK-246 refresh paths and the extracted stalenessRefreshHandlers.
3. Add or update a failing ResearchPage test for the path that currently appears inert.
4. Fix the smallest root cause, preserving identity-drift guards and cost confirmation semantics for search runs.
5. Verify with the focused ResearchPage test, typecheck, lint, and a browser smoke if the bug is UI-only.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the no-op Research rerun fix on the Results Viewer stale-job path. The failing path was the completed-job stale warning: the CTA reused the preserved thesis snapshot without rebasing the submitted deep-research payload to the current Identity revision, so the rerun appeared unchanged. Retry now uses an explicit identity mode: current mode stamps the latest Identity revision and thesis field dependencies, while profile mode preserves profile-backed retry behavior when no Identity is loaded. Review artifacts: .agents/reviews/review-20260531-173610.md and .agents/reviews/test-audit-20260531-173610.md.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed TASK-269 by making Research deep-research retry identity mode explicit. The stale-job "Rerun with current Identity" action now submits a thesis snapshot stamped with the current Identity revision and dependency fields so the backend payload, local run metadata, and stale banner agree. Added regression tests for stale completed-job reruns, failed-run retry with Identity, profile-mode retry without Identity, and profile-mode regenerate from contract violations. Verified with focused ResearchPage tests, full ResearchPage tests, lint, typecheck, build, independent review, and jumbo diff test audit.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 Automatic formatting was applied to touched files
- [x] #4 Regression tests pass (scoped to touched files)
- [x] #5 Linters report no warnings or errors in touched files
- [x] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
