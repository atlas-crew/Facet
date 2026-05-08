---
id: TASK-117
title: Harden strategy vector generation JSON parsing
status: Done
assignee: []
created_date: '2026-04-14 02:47'
updated_date: '2026-04-14 03:00'
labels:
  - bug
  - identity
  - research
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Suggest Search Angles can fail with 'Failed to parse generated search vectors.' when the model returns mildly malformed JSON that other identity flows already repair successfully.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Search vector generation repairs minor AI JSON syntax issues before normalization.
- [x] #2 Unrecoverable vector-generation parse failures still surface a clear error.
- [x] #3 Targeted regressions cover repaired and unrecoverable vector-generation responses.
- [x] #4 Typecheck, targeted Vitest, targeted ESLint, and build pass for the touched files.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Hardened strategy vector and awareness generation to repair minor AI JSON syntax issues before normalization, while still surfacing contextual errors for unrecoverable responses. Added targeted regressions for repaired vector JSON, unrecoverable vector responses, and missing awareness JSON blocks. Verified with typecheck, focused Vitest, targeted ESLint, build, independent review (.agents/reviews/review-20260413-225234.md), and test audit (.agents/reviews/test-audit-20260413-225558.md).
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
