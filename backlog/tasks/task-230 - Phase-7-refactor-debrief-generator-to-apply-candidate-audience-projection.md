---
id: TASK-230
title: 'Phase 7: refactor debrief generator to apply candidate audience projection'
status: In Progress
assignee:
  - '@codex'
created_date: '2026-05-06 20:28'
updated_date: '2026-05-26 08:03'
labels:
  - audience-tagging
  - phase-7
  - debrief
milestone: m-28
dependencies: []
references:
  - src/utils/debriefGenerator.ts
  - src/routes/debrief/DebriefPage.tsx
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

Debriefs are candidate-only — post-interview reflection material. Same audience filter logic as prep. Currently no audience filter is applied.

## What

- Apply `projectForAudience(jd, 'candidate')` in the debrief generator before content extraction
- Verify debrief sections (anchor stories, reflection prompts) still populate correctly
- Update tests with production-shaped fixtures

## Acceptance criteria

- Debrief generator uses projected JDAnalysis
- Existing sections still populate
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-05-26 Codex starting TASK-230. Plan: inspect debriefGenerator/DebriefPage and current tests, apply candidate projection at the generator boundary, update production-shaped audience fixtures, run focused gates plus independent review/audit, commit/close/push.
<!-- SECTION:NOTES:END -->
