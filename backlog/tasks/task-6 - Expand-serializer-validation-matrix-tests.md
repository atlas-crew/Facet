---
id: TASK-6
title: Expand serializer validation matrix tests
status: Done
assignee:
  - '@codex'
created_date: '2026-02-28 05:46'
updated_date: '2026-05-25 14:11'
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
Test audit flagged shallow coverage across serializer field validation. Build a compact matrix of malformed input cases to validate required nested fields and object-shape guards.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Serializer rejects malformed nested records for vectors/projects/bullets/education
- [x] #2 Serializer rejects non-object roots and invalid skill order values
- [x] #3 Round-trip/fallback tests remain passing
- [x] #4 Verification commands pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add targeted failing fixtures for vectors/projects/bullets/education missing required fields.
2. Add tests for non-object roots and invalid skill order values.
3. Keep error assertions path-specific where practical.
4. Run lint/typecheck/test/build.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-05-25 Codex starting TASK-6 in branch codex/task-6. Plan: expand serializerValidation matrix around malformed nested records and object-shape guards for vectors/projects/bullets/education, add root non-object variants and invalid skill order shape/value assertions, run focused serializer tests plus lint/typecheck/build gates, run independent review/audit fallback if needed, commit with cortex git commit and close with receipts.

2026-05-25 closeout: expanded serializerValidation matrix for non-object roots, non-array collections, malformed nested vectors/projects/bullets/education records, required field presence across target lines, vectors, projects, roles, bullets, skill groups, education, nested object-shape guards, invalid vector priority values, invalid legacy and vector skill-order values, invalid optional education year values, and manual override booleans. Verification: pnpm exec vitest run src/test/serializerValidation.test.ts src/test/serializer.test.ts (2 files, 71 tests passed); pnpm exec eslint src/test/serializerValidation.test.ts; pnpm run typecheck; pnpm exec prettier --check --ignore-unknown src/test/serializerValidation.test.ts; git diff --check; pnpm run build passed with existing chunk-size warnings; pnpm run test passed before the final two ID consistency additions (173 files, 2532 tests) and the final focused serializer run passed afterward. Independent Gemini test audit .agents/reviews/test-audit-20260525-101020-gemini.md returned CLEAN after earlier audit findings were remediated.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Expanded the serializer validation matrix with table-driven malformed input coverage for root payloads, nested collection and record shapes, required nested fields, invalid vector priorities, and skill-order validation. Existing serializer round-trip/fallback coverage remains passing, and the final independent test audit returned CLEAN.
<!-- SECTION:FINAL_SUMMARY:END -->
