---
id: TASK-116
title: Fix identity-derived research skill depths defaulting to working
status: Done
assignee: []
created_date: '2026-04-14 01:16'
updated_date: '2026-04-14 01:48'
labels:
  - bug
  - research
  - identity
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Research currently shows 'working' for many or all identity-derived skills because the identity-to-search-profile adapter falls back to a blanket depth value when enrichment depth is missing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Identity-derived research skills preserve explicit enriched depths when present.
- [x] #2 Skills without explicit depth use a deterministic evidence-based fallback instead of always defaulting to working.
- [x] #3 Research page regressions cover the identity-derived skill-depth behavior.
- [x] #4 Typecheck, targeted Vitest, targeted ESLint, and build pass for the touched files.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the blanket identity-to-research skill-depth fallback with deterministic evidence-based inference so unenriched skills no longer all show as working. Added a ResearchPage regression that preserves explicit enriched depth and verifies strong/basic inferred cases, plus a focused adapter test for lighter project-only evidence. Verified with typecheck, focused Vitest, targeted ESLint, build, an independent code review (.agents/reviews/review-20260413-214151.md), and a test audit (.agents/reviews/test-audit-20260413-214424.md).
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
