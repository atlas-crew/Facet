---
id: TASK-65
title: Define unified workspace snapshot contract and persistence coordinator
status: Done
assignee:
  - '@codex'
created_date: '2026-03-11 17:40'
updated_date: '2026-03-11 18:20'
labels:
  - refactor
  - architecture
  - persistence
milestone: m-11
dependencies: []
references:
  - src/store/storage.ts
  - src/store/resumeStore.ts
  - src/store/pipelineStore.ts
  - src/store/prepStore.ts
  - src/store/coverLetterStore.ts
  - src/store/searchStore.ts
documentation:
  - 'backlog://document/doc-5'
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create the persistence foundation described in doc-5: a single versioned workspace snapshot schema plus a backend-agnostic coordinator interface that can sit between existing Zustand stores and future storage backends. This is the first step toward tenant-aware persistence and should not require shipping server auth yet.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A versioned app-level snapshot contract is defined for durable workspace data, with placeholders for tenantId and userId even in local-only mode.
- [x] #2 A persistence coordinator interface is defined for bootstrap/load/save/export/import/status flows without coupling to a specific backend.
- [x] #3 Durable domain data and local-only UI/session state boundaries are explicitly documented so future sync work does not capture transient UI state.
- [x] #4 A migration plan is documented for reading existing localStorage-backed store data into the unified snapshot contract without user data loss.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a Phase 1 persistence foundation in `src/persistence/` with a versioned workspace snapshot contract, local-preferences split, backend-agnostic coordinator, runtime snapshot validation, and declarative migration mapping from existing persisted store keys. Added focused coverage in `src/test/persistence.test.ts` for snapshot assembly, patch immutability, coordinator lifecycle/error paths, import validation, and revision semantics.

Verification: `npm run typecheck` passed, `npx vitest run src/test/persistence.test.ts` passed (13 tests), `npm run build` passed, and targeted `npx eslint src/persistence src/test/persistence.test.ts` passed.

External review artifacts: `.agents/reviews/review-20260311-141657.md` and `.agents/reviews/test-audit-20260311-141657.md`. Remaining non-blocking gaps were captured in follow-up TASK-69.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the first persistence-layer foundation for Facet: versioned workspace snapshot and local-preferences contracts, a backend-agnostic coordinator with validation and status tracking, store-backed snapshot builders, migration mapping from current persisted keys, and regression coverage for the coordinator and validation flows. Verified with typecheck, targeted Vitest, targeted ESLint, build, plus repeated Claude review/test-audit passes. Filed TASK-69 for remaining non-blocking persistence hardening findings.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Documentation has been created/modified/removed as needed.
- [ ] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [ ] #4 Test changes were approved by a test gap analysis review
- [x] #5 Changes to integration points are covered by tests
- [x] #6 All tests pass successfully
- [ ] #7 Automatic formatting was applied.
- [x] #8 Linters report no WARNINGS or ERRORS
- [x] #9 The project builds successfully
<!-- DOD:END -->
