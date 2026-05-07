---
id: TASK-237
title: Add identitySearchProfile depth-inference coverage
status: To Do
assignee: []
created_date: '2026-05-07 00:18'
labels:
  - test-gap
  - research
  - identity
dependencies: []
references:
  - .agents/reviews/test-audit-20260506-201619.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up from TASK-196.1 test audit. The focused identitySearchProfile audit found pre-existing high-severity coverage gaps around depth inference alias matching: word-boundary false positives and generic skill term exclusion are untested, with additional P1 gaps for strong/basic depth boundaries and remote/compensation/interview fallback branches. Keep this scoped to tests unless implementation defects are found.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Depth inference tests cover word-boundary false positives and regex-escaped aliases.
- [ ] #2 Depth inference tests cover generic skill term exclusion without inflating Backend/Security-style skills.
- [ ] #3 Depth ladder tests cover direct role-technology strong evidence, score-threshold strong evidence, and basic fallback.
- [ ] #4 Relevant focused tests, typecheck, and lint pass.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Linters report no WARNINGS or ERRORS for touched files
- [ ] #5 Regression tests pass for touched files
<!-- DOD:END -->
