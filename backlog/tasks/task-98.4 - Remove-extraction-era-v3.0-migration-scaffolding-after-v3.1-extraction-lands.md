---
id: TASK-98.4
title: Remove extraction-era v3.0 migration scaffolding after v3.1 extraction lands
status: Done
assignee:
  - '@codex'
created_date: '2026-04-09 23:45'
updated_date: '2026-04-12 00:22'
labels:
  - refactor
  - identity
  - v3-1
  - cleanup
milestone: m-15
dependencies:
  - TASK-98
documentation:
  - /Users/nick/Developer/Facet/src/identity/schema.ts
parent_task_id: TASK-98
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After Milestone 2 is verified, delete the pre-launch migration helpers that only exist to convert v3 extraction output into v3.1.

This includes schema revision scaffolding, role_fit compatibility paths, derived depth/matching helpers, and related parser branches that should no longer be reachable once extraction emits native v3.1 data.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Schema import no longer carries extraction-only migration helpers once native v3.1 extraction is verified.
- [x] #2 role_fit, schema revision compatibility, and derived helper code are removed or unreachable in the schema parser.
- [x] #3 Fixtures/tests no longer depend on migration-only fields such as role_fit or proficiency.
- [x] #4 Focused schema and extraction validation passes after cleanup.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
User confirmed there are no current users, so proceed with the broader parser cleanup now instead of preserving legacy identity import compatibility.
Implementation focus for TASK-98.4:
1. Remove schema parser migration helpers that only exist for pre-v3.1 identity input, including migrateProfessionalIdentityToV31 and extraction-era role_fit/schema_revision fallback branches.
2. Remove proficiency-to-depth and legacy role_fit-derived matching expectations from schema fixtures/tests where the parser contract is now explicitly v3.1-only.
3. Update affected tests and fixtures across schema/identity consumers so they provide native v3.1 matching/depth fields instead of legacy migration-only fields.
4. Re-run focused schema and extraction validation, then independent review/test audit, then commit with cortex git commit if the slice is clean.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
User confirmed there are no current users, so broader parser cleanup is acceptable for TASK-98.4.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed extraction-era v3.0 migration scaffolding from the schema/runtime path by making importProfessionalIdentity v3.1-native, deleting role_fit/proficiency fallbacks, updating parser shells and fixtures, and tightening focused regression coverage. Validation passed with `npm run typecheck`, `npx vitest run src/test/professionalIdentity.test.ts src/test/identityExtraction.test.ts src/test/jobMatch.test.ts src/test/identityMerge.test.ts src/test/linkedinProfileGenerator.test.ts src/test/LinkedInPage.test.tsx src/test/debriefPatterns.test.ts src/test/persistence.test.ts`, and `npm run build`; independent artifacts are `.agents/reviews/review-20260411-062832.md` and `.agents/reviews/test-audit-20260411-061555.md`.
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
