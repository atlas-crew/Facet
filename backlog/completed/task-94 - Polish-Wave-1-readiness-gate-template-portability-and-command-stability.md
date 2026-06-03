---
id: TASK-94
title: Polish Wave 1 readiness gate template portability and command stability
status: Done
assignee:
  - '@codex'
created_date: '2026-04-08 06:54'
updated_date: '2026-05-10 00:26'
labels:
  - documentation
milestone: Wave 1 Hosted Accounts Launch Readiness
dependencies: []
references:
  - ./.agents/reviews/review-20260408-025234.md
modified_files:
  - package.json
  - docs/development/platform/wave-1-beta-readiness-gate.md
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deferred from review artifact ./.agents/reviews/review-20260408-025234.md. The current readiness gate content is accurate, but the reviewer flagged maintainability follow-ups: markdown portability of multi-line table cells, a note about the template field-name migration, and the long manual Vitest command used as a local receipt.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Reduce portability risk in the decision-log blocker formatting without losing scanability.
- [x] #2 Document or normalize the readiness gate template field migration so future validators are not confused by older snapshots.
- [x] #3 Replace the long manual Wave 1 Vitest receipt command with a stable script or alias if that path remains part of local validation.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Decide whether the readiness gate is GFM-only or should stay renderer-agnostic.
2. If portability matters, replace the current multi-line blocker formatting with a more portable representation.
3. Add a stable scripted Wave 1 validation command or explicitly document why the manual command remains acceptable.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-04-08: Follow-on readiness-gate review ./.agents/reviews/review-20260408-054907.md flagged one deferred evidence-quality item: operator-reported validations should eventually link to a traceable artifact instead of only naming the release thread.

2026-04-08: Additional deferred readiness-gate review ./.agents/reviews/review-20260408-055106.md noted that operator-reported validations should eventually point at a durable reference, and that template guidance could be made more visually prominent.

Starting TASK-94 as an independent doc/script stability slice while Wave 1 implementation workers run in parallel. Plan: add a stable Wave 1 local Vitest script, update the readiness gate to reference it, replace fragile table line breaks with portable references, and document the template field migration/partial status guidance.

Added pnpm run test:wave1 as the stable focused Wave 1 local validation alias and updated the readiness gate to reference it. Replaced fragile <br>-based blocker rows with normal markdown numbered lists under Current Blocking Details. Added template guidance for partial status, Candidate build note, and the 2026-04-08 field-name migration from older snapshots. Verification: pnpm run test:wave1 passed (5 files, 128 tests); git diff --check passed for touched files; npm run format:files applied. Independent docs/test review found one stale count, remediated; after the count fix reviewer score would be 8.5/10. npm run typecheck was initially clean for this docs/script slice before parallel worker changes; a later rerun is currently blocked by in-progress TASK-241 edits in billing tests/types, so build/typecheck are not marked as final gates for this task.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Wave 1 readiness gate now uses a stable test:wave1 receipt, has portable blocker formatting, and documents the decision-log template migration.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [x] #2 Documentation has been created/modified/removed as needed.
- [x] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [x] #4 Test changes were approved by a test gap analysis review
- [x] #5 Changes to integration points are covered by tests
- [x] #6 All tests pass successfully
- [x] #7 Automatic formatting was applied.
- [x] #8 Linters report no WARNINGS or ERRORS
- [ ] #9 The project builds successfully
<!-- DOD:END -->
