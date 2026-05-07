---
id: TASK-204.2
title: Remove duplicate filter arrays from thesis generation contract
status: Done
assignee:
  - '@codex'
created_date: '2026-05-06 22:46'
updated_date: '2026-05-07 18:55'
labels:
  - refactor
  - search-redesign
  - lane-b
dependencies:
  - TASK-204.1
references:
  - src/utils/thesisGenerator.ts
  - src/test/thesisGenerator.test.ts
documentation:
  - backlog doc-39
  - backlog TASK-204.1
  - backlog TASK-204
parent_task_id: TASK-204
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update thesis generation per doc-39 after TASK-204.1 defines the canonical thesis signal shape. The LLM response schema should emit canonical search-stage lookFor/avoid only, not duplicate searchOverrides.filters.prioritize/searchOverrides.filters.avoid arrays. Normalization may accept legacy generated filter arrays as migration input, but new generation must not produce them as canonical output.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 thesisGenerator prompt schema no longer asks the LLM for searchOverrides.filters.prioritize or searchOverrides.filters.avoid
- [x] #2 normalizeGeneratedSearchThesis maps any legacy generated filter arrays through the canonical signal migration path instead of preserving duplicate storage
- [x] #3 Generated thesis tests assert canonical lookFor/avoid output and absence of searchOverrides.filters in new theses
- [x] #4 Contract-violation or fixture tests are updated to reflect the single search-stage signal surface
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Pinned the thesis-generation contract to canonical search-stage signal output. The response-schema test now asserts structured lookFor/avoid signal objects and no filters/prioritize/searchOverrides.filters entries inside the schema block. Added generated-output assertions for canonical signals and migration-only legacy filter handling for malformed, one-sided, and non-array legacy inputs.

Validation: npm run typecheck; npx vitest run src/test/thesisGenerator.test.ts (11 tests); npx eslint src/test/thesisGenerator.test.ts src/utils/thesisGenerator.ts.

Independent test audit: .agents/reviews/test-audit-20260507-145409.md (P0/P1/P2=0).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Pinned TASK-204.2 with generator regression coverage: the LLM response schema no longer exposes duplicate searchOverrides.filters arrays, generated theses are asserted as canonical lookFor/avoid signals, and legacy generated filters remain accepted only as migration input that folds into canonical signals and disappears from output.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 Automatic formatting was applied to touched files
- [x] #4 Linters report no WARNINGS or ERRORS for touched files
- [x] #5 Regression tests pass for touched files
<!-- DOD:END -->
