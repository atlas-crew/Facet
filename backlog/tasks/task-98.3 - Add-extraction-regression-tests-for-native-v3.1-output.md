---
id: TASK-98.3
title: Add extraction regression tests for native v3.1 output
status: Done
assignee: []
created_date: '2026-04-09 23:45'
updated_date: '2026-04-12 00:22'
labels:
  - feature
  - identity
  - testing
  - v3-1
milestone: m-15
dependencies: []
documentation:
  - /Users/nick/Developer/Facet/src/test/identityExtraction.test.ts
parent_task_id: TASK-98
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update and expand extraction tests so the extraction layer proves it emits and accepts native v3.1 output.

The main regression target is that parseIdentityExtractionResponse can hand a fresh extraction directly to importProfessionalIdentity without migration-style warnings.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 identityExtraction tests assert a native v3.1 payload parses successfully with search_vectors, awareness, and preferences.matching present.
- [x] #2 Tests verify migration-style warnings are absent for native v3.1 extraction output.
- [x] #3 Tests verify legacy role_fit is dropped when emitted in an extraction response.
- [x] #4 The milestone records focused test, typecheck, and build commands needed for closure.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update existing extraction fixtures that still assume role_fit or other v3-era shapes.
2. Add a regression test for a minimal native v3.1 extraction payload.
3. Add a regression test that legacy role_fit is dropped if emitted by the LLM.
4. Run focused extraction tests plus typecheck/build receipts.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Expanded `src/test/identityExtraction.test.ts` so native v3.1 extraction payloads import cleanly, migration-style warnings stay absent for native output, and legacy role_fit is dropped instead of reaching the schema parser. Milestone closure receipts are now recorded from `npx vitest run src/test/identityExtraction.test.ts`, `npm run typecheck`, and `npm run build`.
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
