---
id: TASK-98.1
title: Rewrite extraction prompts to emit schema v3.1
status: Done
assignee:
  - codex
created_date: '2026-04-09 23:44'
updated_date: '2026-04-12 00:22'
labels:
  - feature
  - identity
  - extraction
  - v3-1
milestone: m-15
dependencies: []
documentation:
  - /Users/nick/Developer/Facet/src/utils/identityExtraction.ts
parent_task_id: TASK-98
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the extraction prompt contract in src/utils/identityExtraction.ts so fresh extraction output targets the shipped v3.1 schema directly.

This includes removing prompt references to schema v3 and preferences.role_fit, requiring preferences.matching, search_vectors, and awareness in the output shape, and keeping first-extract skill items limited to name/tags so enrichment remains the path for depth/context/search_signal.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 EXTRACTION_SYSTEM_PROMPT names Professional Identity Schema v3.1 and uses the v3.1 top-level section layout.
- [x] #2 The prompt no longer asks for preferences.role_fit or skill proficiency.
- [x] #3 The prompt explicitly requires preferences.matching, search_vectors, and awareness with empty defaults for first extract output.
- [x] #4 BULLET_DEEPENING_SYSTEM_PROMPT references v3.1 and preserves existing bullet-shape rules.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Rewrite EXTRACTION_SYSTEM_PROMPT to target Professional Identity Schema v3.1 directly and remove preferences.role_fit guidance.
Require preferences.matching, search_vectors, and awareness in the prompt with empty/default-first extraction guidance while leaving enrichment-owned depth/context/search-signal fields intentionally sparse.
Update BULLET_DEEPENING_SYSTEM_PROMPT to reference Professional Identity Schema v3.1 without changing the bullet decomposition contract.
Refresh focused extraction tests so fixture data and assertions match the prompt contract before moving to normalization.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Prompt contract updated to v3.1 and covered by focused extraction tests; final commit is waiting on the remaining extraction-normalization review findings in the combined TASK-98.1/TASK-98.2 slice.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Updated EXTRACTION_SYSTEM_PROMPT and BULLET_DEEPENING_SYSTEM_PROMPT to target Professional Identity Schema v3.1 directly, removed role_fit/proficiency guidance, and covered the new contract in focused extraction tests. Validation for the completed slice passed with `npx vitest run src/test/identityExtraction.test.ts`, `npm run typecheck`, and `npm run build`.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [ ] #2 Documentation has been created/modified/removed as needed.
- [ ] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [x] #4 Test changes were approved by a test gap analysis review
- [x] #5 Changes to integration points are covered by tests
- [x] #6 All tests pass successfully
- [ ] #7 Automatic formatting was applied.
- [ ] #8 Linters report no WARNINGS or ERRORS
- [x] #9 The project builds successfully
<!-- DOD:END -->
