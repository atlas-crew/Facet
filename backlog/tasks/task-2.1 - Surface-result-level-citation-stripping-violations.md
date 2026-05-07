---
id: TASK-2.1
title: Surface result-level citation stripping violations
status: Done
assignee:
  - '@lane-a-worker'
created_date: '2026-05-06 23:06'
updated_date: '2026-05-07 21:26'
labels:
  - remediation
dependencies: []
parent_task_id: TASK-2
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Independent review of TASK-184 noted that normalizeResults() strips unresolved citation markers from matchReason/vectorAlignment/candidateEdge, but result-level fields that become empty do not currently flow into a contract-violations channel. The current TASK-184 slice drops unresolved markers per acceptance criteria; this follow-up should add observability without broadening the shipped citation rendering contract.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 normalizeResults or its caller exposes result-level citation stripping violations for QA/telemetry.
- [x] #2 Search run contract violations include result field names when required prose becomes empty after unresolved citation markers are stripped.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented result-level citation-stripping diagnostics in search normalization. normalizeResultsWithContractViolations returns normalized entries plus rawResults[field] contract violations when unresolved citation cleanup leaves no substantive prose; executeSearch returns the same contractViolations array and logs non-empty violations for QA visibility. Added citation helper diagnostics in searchCitations so unresolved-marker stripping and prose checks share the citation parser. Focused tests cover empty payload shape, unresolved-only fields, resolved-only marker preservation, non-ASCII prose, tier-cap dropped raw results, invalid-entry raw index preservation, whitespace/missing fields, executeSearch propagation, and warn/no-warn behavior. Validation: npm run typecheck; npx vitest run src/test/searchExecutor.test.ts (57 passed); npx eslint src/utils/searchExecutor.ts src/utils/searchCitations.ts src/test/searchExecutor.test.ts; git diff --check for touched files. Independent artifacts: .agents/reviews/review-20260507-171019.md (source review still reports P1 questions requiring confirmation; confirmed normalizeResults wrapper exists, tsconfig target is ES2022/ES2023, executeSearch has no production callers outside tests, and audit passed with no P0/P1); .agents/reviews/test-audit-20260507-171019.md (P0/P1=0, one P1 coverage gap noted and covered before final validation).

Post-close cleanup: normalized the final TASK-2.1 source shape after concurrent commits landed underneath this worker. Current validation receipts: npm run typecheck; npx vitest run src/test/searchExecutor.test.ts (57 passed); npx eslint src/utils/searchCitations.ts src/utils/searchExecutor.ts src/test/searchExecutor.test.ts. Current independent source review: .agents/reviews/review-20260507-172533.md CLEAN. Current diff test audit: .agents/reviews/test-audit-20260507-172557.md P0/P1/P2=0.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Surfaced result-level citation stripping diagnostics from search normalization. Added citation-strip diagnostics in searchCitations, normalizeResultsWithContractViolations in searchExecutor, rawResults[field] contract-violation strings with surfaced/dropped result context, and executeSearch propagation/logging. Focused regression coverage now pins unresolved-only, resolved-only, non-ASCII, tier-cap, invalid raw-index, empty payload, whitespace/missing, and executeSearch propagation paths.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 Automatic formatting was applied to touched files
- [x] #4 Linters report no WARNINGS or ERRORS for touched files
- [x] #5 Regression tests pass for touched files
<!-- DOD:END -->
