---
id: TASK-239
title: Exclude generated build artifacts from repo lint scope
status: In Progress
assignee:
  - '@codex'
created_date: '2026-05-07 00:45'
updated_date: '2026-05-25 13:47'
labels:
  - bug
  - cleanup
  - tooling
dependencies: []
references:
  - eslint.config.js
documentation:
  - >-
    backlog/tasks/task-206 -
    Verify-searchProfileInference-resume-mode-has-no-live-callers-and-retire-if-dead.md
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-206 verification confirmed direct focused ESLint passes, but npm run lint expands to eslint . and reports generated .vercel/dist-unmin artifacts plus existing repository lint debt. Tighten lint inputs/ignores so generated build outputs do not mask actionable source lint failures.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 npm run lint no longer traverses generated .vercel or dist-unmin build artifacts.
- [ ] #2 Any remaining source lint debt is reported separately from generated artifact noise.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-05-25 Codex starting TASK-239 in branch codex/task-239. Plan: inspect current ESLint ignore/config and package lint command; reproduce or identify generated-artifact traversal for .vercel/dist-unmin; tighten lint ignores/input scope without masking source lint; run focused config checks plus npm run lint to separate generated artifact noise from remaining source debt; format touched config/docs; commit with cortex git commit and close task with exact lint receipts.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Generated build outputs are excluded from repo lint traversal.
- [ ] #2 npm run lint verification distinguishes generated-artifact noise from remaining source lint debt.
- [ ] #3 Touched config/documentation files are formatted.
- [ ] #4 Final summary records the exact lint command results.
<!-- DOD:END -->
