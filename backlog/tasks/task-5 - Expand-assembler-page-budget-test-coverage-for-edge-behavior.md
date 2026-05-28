---
id: TASK-5
title: Expand assembler/page-budget test coverage for edge behavior
status: In Progress
assignee:
  - '@codex'
created_date: '2026-02-28 05:46'
updated_date: '2026-05-28 20:01'
labels:
  - remediation
  - testing
dependencies: []
references:
  - .agents/reviews/test-audit-20260227-173406.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Test audit identified untested edge behavior in engine assembly and page-budget estimation. Add focused tests for ordering, all-vector logic, passthrough contracts, and line-estimation boundaries.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Line-estimation functions are directly covered for key boundary cases
- [x] #2 Assembler covers skill ordering and profile/override edge selection
- [x] #3 Header and education passthrough are asserted
- [x] #4 Verification commands pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add direct tests for estimateResumeLines/estimateWrappedLines boundary conditions.
2. Add assembler tests for skill-group ordering, profile priority selection, partial bullet-order maps, and header/education passthrough.
3. Add override precedence tests for key specificity.
4. Run lint/typecheck/test/build.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Starting TASK-5. I will keep this to focused engine test hardening: inspect existing assembler/page-budget coverage, add boundary tests for line estimation/page usage, assembly edge tests for skill ordering/profile/override/passthrough behavior, run focused and full verification, then request independent diff test audit before closeout.

Implemented assembler/page-budget edge coverage and hardening. Added direct line/page usage boundary tests, expanded assembler tests for vector/default behavior, skill-group ordering and overrides, profile/target selection, bullet ordering, passthrough fields, variable/variant resolution, malformed override payloads, and sparse legacy payload handling. Fixed assembler handling for missing/null vector maps, explicit empty string variants, skill-group manual overrides, non-finite skill-group order, sparse top-level arrays/meta, missing role bullets, and missing component text. Independent source review: .agents/reviews/review-20260528-155624.md (P3 only). Final module audit: .agents/reviews/task5-engine-module/test-audit-20260528-155805.md (no prioritized gaps).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Expanded assembler and page-budget coverage for edge behavior, including line-estimation boundaries, all-vector/default paths, skill ordering, profile/target selection, override precedence, passthrough contracts, variable/variant handling, and malformed legacy payloads. Hardened assembler normalization for sparse legacy input, null/missing vectors, empty variants, non-finite skill orders, missing role bullets, and missing text. Verification passed: npm run typecheck; focused vitest/eslint/format checks; npm run lint; npm run test; npm run build. Independent source review found only P3 residual suggestions; final test audit reported no prioritized gaps.
<!-- SECTION:FINAL_SUMMARY:END -->
