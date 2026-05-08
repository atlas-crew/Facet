---
id: TASK-125
title: Increase interview prep AI timeout for larger prompt payloads
status: Done
assignee: []
created_date: '2026-04-14 16:38'
updated_date: '2026-04-14 16:41'
labels:
  - bug
  - ai
  - prep
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Raise the prep generator timeout so interview prep requests with job descriptions, company research, and resume context do not fail prematurely at 45 seconds.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Interview prep uses a longer AI timeout than the shared default to account for its larger prompt payloads.
- [x] #2 Focused regression coverage exists for the interview prep timeout option passed into the shared proxy client.
- [x] #3 Targeted verification passes with typecheck, focused vitest, eslint, and build.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Raised the interview prep generator timeout from 45s to 90s via a dedicated PREP_TIMEOUT_MS constant and added focused regression coverage verifying the extended timeout is passed into callLlmProxy. Verification passed with focused vitest, typecheck, eslint, and build.
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
