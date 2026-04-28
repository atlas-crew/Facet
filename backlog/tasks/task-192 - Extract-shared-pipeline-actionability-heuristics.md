---
id: TASK-192
title: Extract shared pipeline actionability heuristics
status: To Do
assignee:
  - Codex
created_date: '2026-04-28 01:31'
labels:
  - ux
  - pipeline
  - tech-debt
dependencies: []
references:
  - src/routes/home/HomePage.tsx
  - src/routes/pipeline/PipelinePage.tsx
  - .agents/reviews/review-20260427-212837.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up from TASK-191 review artifact .agents/reviews/review-20260427-212837.md. HomePage now owns pipeline freshness/actionability heuristics locally (active statuses, awaiting-action statuses, stale saved-JD window, upcoming interview window, and meaningful next-step detection). Extract these into a shared utility so Pipeline, Prep, and Home do not drift.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Pipeline actionability constants and predicates live in one shared utility instead of HomePage-local helpers.
- [ ] #2 HomePage imports the shared helper without changing visible behavior.
- [ ] #3 Pipeline or Prep surfaces that need the same active/stale/upcoming definitions reuse the helper or explicitly document why they differ.
- [ ] #4 Focused tests cover meaningful next-step, stale saved JD, and upcoming interview thresholds.
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
