---
id: TASK-63
title: Close researchUtils edge-case coverage gaps
status: Done
assignee:
  - '@myself'
created_date: '2026-03-11 04:02'
updated_date: '2026-05-06 23:52'
labels:
  - test-gap
  - research
milestone: m-4
dependencies: []
references:
  - .agents/reviews/test-audit-20260310-235950.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up from researchUtils audit to close remaining immutability and boundary-case gaps in the extracted Research helpers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 researchUtils tests cover non-mutating behavior for upsertVectorConfig and groupByTier empty/out-of-range inputs.
- [x] #2 researchUtils tests cover normalizeMaxResults float parsing, toPipelineTier negative/zero inputs, and createPipelineEntryDraft multi-risk joins.
- [x] #3 Tag helper tests cover single-value and whitespace-only cases, and joinTags covers empty-array behavior.
- [x] #4 Targeted research utility tests, typecheck, and targeted eslint pass after the additions.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect researchUtils helpers and existing tests to identify the missing edge cases from TASK-63.
2. Add behavior-focused tests for immutability, boundary normalization, tier filtering, tag helpers, interview format parsing, provenance handling, and pipeline draft notes.
3. Run focused research utility tests, typecheck, touched-file eslint, production build, prettier, and a quick test-gap audit.
4. Update TASK-63 and commit the scoped test/backlog changes with cortex git commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lane D verification receipts (2026-05-06):
- npx vitest run src/test/researchUtils.test.ts: PASS, 14 tests.
- npm run typecheck: PASS.
- npx eslint src/test/researchUtils.test.ts: PASS.
- npm run build: PASS, Vite built successfully with existing large-chunk warning.
- npx prettier --write src/test/researchUtils.test.ts: applied.
- Quick test audit: .agents/reviews/test-audit-20260506-194738.md; post-audit P1s for malformed provenance URLs, draft input mutation, source-origin variants, resumeVersion boundaries, maxResults extremes, and empty matchReason were remediated before commit.
- Documentation approval DoD is not applicable: this was a test-only slice with no docs changed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Expanded researchUtils edge-case coverage for tag parsing/joining, emptyProfile boundaries, vector upsert ordering and immutability, request draft vector edges, tier grouping invalid values and non-mutation, maxResults parsing extremes, pipeline draft provenance and notes behavior, interview format parsing, and interview signal combinations. Focused tests/lint/typecheck/build pass; no production code changes were required.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Documentation has been created/modified/removed as needed.
- [ ] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [x] #4 Test changes were approved by a test gap analysis review
- [x] #5 Changes to integration points are covered by tests
- [x] #6 All tests pass successfully
- [x] #7 Automatic formatting was applied.
- [x] #8 Linters report no WARNINGS or ERRORS
- [x] #9 The project builds successfully
<!-- DOD:END -->
