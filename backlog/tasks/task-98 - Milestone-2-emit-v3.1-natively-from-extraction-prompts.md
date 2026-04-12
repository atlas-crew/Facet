---
id: TASK-98
title: 'Milestone 2: emit v3.1 natively from extraction prompts'
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
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement Milestone 2 of the v3.1 rollout in the extraction layer.

Scope:
- update extraction prompts in src/utils/identityExtraction.ts to emit Professional Identity Schema v3.1 natively
- update bullet deepening prompt version reference to v3.1
- normalize new v3.1 fields in parse/repair flow
- add regression tests proving fresh extraction imports without migration warnings
- defer migration-helper deletion to a follow-on cleanup task after verification

This milestone should leave fresh extractions aligned with the shipped v3.1 schema and the enrichment wizard contract.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 EXTRACTION_SYSTEM_PROMPT emits the v3.1 shape and no longer asks for preferences.role_fit.
- [x] #2 BULLET_DEEPENING_SYSTEM_PROMPT references Professional Identity Schema v3.1.
- [x] #3 normalizeExtractedIdentityCandidate repairs/defaults v3.1 fields and drops legacy role_fit output.
- [x] #4 Focused extraction tests prove a fresh extraction imports cleanly as v3.1 without migration warnings.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Execute Milestone 2 as sequential atomic loops with the first slice combining TASK-98.1 and TASK-98.2 because the importer currently hard-requires preferences.role_fit and would reject a prompt-only native v3.1 payload.
Loop 1 touches src/utils/identityExtraction.ts and src/test/identityExtraction.test.ts to update the extraction prompt and normalize native v3.1 extraction fields together while preserving schema cleanup for TASK-98.4.
After Loop 1, run focused validation, request independent code review and test audit per agent-loops, and commit only touched files with cortex git commit before proceeding to the remaining regression/cleanup work.

User approved continuing the active TASK-98.1/TASK-98.2 slice before opening TASK-98.3.
Immediate implementation focus:
1. Fix normalizePreferences so partial or malformed preferences.matching backfills missing prioritize/avoid arrays from legacy preferences.role_fit before the legacy field is cleared.
2. Keep deprecated role_fit compatibility at the import boundary by deriving it from parsed matching for schema_revision 3.1 payloads that omit role_fit.
3. Expand focused extraction regression tests for omitted preferences, mixed matching+role_fit payloads, and malformed search_vectors/awareness defaults.
4. Re-run focused validation, then request independent code review and test audit before committing with cortex git commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Approved implementation sequence with user: start on TASK-98.1 prompt contract, then continue through normalization, regression tests, and cleanup in atomic loops.

Adjusted execution plan with user approval: combine TASK-98.1 and TASK-98.2 into the first atomic slice because prompt-only v3.1 output would currently fail schema import.

Progress checkpoint:
- Updated extraction prompts to target Professional Identity Schema v3.1 and documented matching/search_vectors/awareness defaults.
- Added extraction-layer normalization for schema_revision, preferences defaults, matching fallback from legacy role_fit, and native v3.1 import compatibility.
- Updated schema import compatibility for schema_revision 3.1 documents and expanded focused extraction coverage to 28 tests.
- Validation receipts on current working tree: npx vitest run src/test/identityExtraction.test.ts, npm run typecheck, npm run build all pass.
- Remaining blocker before commit: latest independent review still flags partial matching-row normalization and malformed search_vectors/awareness entry sanitization.

User approved continuing the active TASK-98.1/TASK-98.2 slice with the review blockers as the immediate scope.

Progress checkpoint on the active TASK-98.1/TASK-98.2 slice:
- Updated extraction normalization to sanitize matching rows entry-by-entry, generate missing ids, drop legacy preferences.role_fit before schema import, and filter malformed search_vectors/awareness entries before strict import.
- Expanded focused regression coverage in src/test/identityExtraction.test.ts; current receipt: npx vitest run src/test/identityExtraction.test.ts -> 30 passed.
- Validation receipts: npm run typecheck -> pass, npm run build -> pass.
- Provider-backed independent review/audit notes: Claude and Gemini script invocations hung with zero-byte artifacts, so the agent-loops fallback artifacts were produced with Codex at .agents/reviews/review-20260411-045538.md and .agents/reviews/test-audit-20260411-045538.md.
- Current blocker before commit: review artifact flags a contract decision around preserving legacy role_fit.evaluation_criteria versus strictly dropping role_fit during v3.1 extraction normalization.

User decision on 2026-04-11: choose strict v3.1 extraction contract. Legacy preferences.role_fit.evaluation_criteria will not be preserved through extraction normalization; compatibility remains limited to deriving role_fit ideal/red_flags from matching at import time.

Atomic commit for the current TASK-98.1/TASK-98.2 slice: 5f48748 fix(identity): normalize native v3.1 extraction payloads
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Milestone 2 now emits and accepts Professional Identity Schema v3.1 natively across the extraction layer. Across the milestone’s atomic slices we updated the extraction prompts, normalized native v3.1 payloads, expanded regression coverage, and removed extraction-era migration scaffolding; validation passed with focused Vitest suites, `npm run typecheck`, and `npm run build`, and the latest independent review ended at P3-only in `.agents/reviews/review-20260411-062832.md`.
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
