---
id: TASK-196.1
title: >-
  Add bank enums + identity preference fields (industries, funding, employment,
  surface remote)
status: In Progress
assignee:
  - '@codex'
created_date: '2026-04-29 08:41'
updated_date: '2026-05-07 00:19'
labels:
  - search-redesign
  - identity-model
dependencies: []
references:
  - src/types/search.ts
  - src/identity/schema.ts
  - src/utils/identitySearchProfile.ts
  - src/store/searchStore.ts
  - src/test/searchStore.test.ts
  - src/test/ResearchPage.test.tsx
documentation:
  - backlog doc-34 (Search Parameters Surface — Design)
  - backlog doc-24 (Search Workspace Redesign)
parent_task_id: TASK-196
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Schema foundation for the search parameters surface. Adds the four hard-constraint banks (industries to avoid, funding stages acceptable, remote policies, employment types) as static const arrays in `src/types/search.ts`, extends `identity.preferences.constraints` with the corresponding optional fields, and surfaces `identity.preferences.work_model.preference` into `SearchProfileConstraints.remotePolicies` via the existing `identitySearchProfile` adapter.

Without this task, subtask .4 (UI controls) has no types to bind to and the adapter has nothing to mirror.

Bank members, exact type definitions, identity-side schema additions, and adapter mirror direction are specified in backlog doc-34 sections 1–3. Reader: do not re-derive bank members from prior conversation; use doc-34 as the source of truth.

Backward compatibility: all new identity fields are optional, so existing persisted state stays valid. New SearchProfileConstraints fields are populated by the adapter; persisted SearchProfile state needs migration in `searchStore.migrateSearchState` (see doc-34 §6).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Four bank enums exported from src/types/search.ts: SearchIndustry, SearchFundingStage, SearchRemotePolicy, SearchEmploymentType, with const arrays containing the canonical members listed in doc-34 §1
- [x] #2 Each bank ships with a display-label map (raw enum value → user-facing label)
- [x] #3 REMOTE_POLICY_BANK values align with the existing identity.preferences.work_model.preference enum
- [x] #4 identity.preferences.constraints extended with optional industries_to_avoid, funding_stages_acceptable, employment_types fields (backward-compatible, all optional)
- [x] #5 SearchProfileConstraints extended with industriesToAvoid, fundingStagesAcceptable, remotePolicies, employmentTypes (camelCase per existing convention)
- [x] #6 identitySearchProfile.adaptIdentityToSearchProfile populates the new SearchProfileConstraints fields from identity preferences
- [x] #7 searchStore.migrateSearchState initializes the new SearchProfileConstraints fields to empty arrays for legacy persisted state
- [x] #8 New tests cover the adapter mirroring: identity preferences → SearchProfileConstraints round-trip
- [ ] #9 Existing tests in src/test/* pass without modification
- [x] #10 Type system rejects bank values that are not enum members
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add doc-34 bank constants, union types, and display-label maps in src/types/search.ts.
2. Extend identity preference constraints with optional industry/funding/employment banks and mirror work_model.preference into SearchProfileConstraints.remotePolicies plus remotePolicyNote.
3. Add migration/hydration defaults for the new SearchProfileConstraints fields, preserve additive override/profile fields, and field-merge identity constraints to avoid data loss.
4. Add focused adapter/schema/migration/merge/ResearchPage regression tests.
5. Run targeted tests, typecheck, touched-file lint, build, source review, and focused test audit before committing scoped files.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lane C verification receipts (2026-05-07):
- Read updated doc-38; it confirms TASK-196.1 was already in flight, while future Lane C starts should prefer TASK-196.2/TASK-196.5 and avoid TASK-196.3 until Lane B TASK-204.1 lands.
- npm run typecheck: PASS.
- npx vitest run src/test/identitySearchProfile.test.ts src/test/professionalIdentity.test.ts src/test/searchStore.test.ts src/test/identityMerge.test.ts: PASS, 96 tests.
- npx vitest run src/test/ResearchPage.test.tsx -t "restores the prior resume-backed profile after leaving identity mode": PASS, 1 test / 70 skipped.
- npx eslint touched source/test files: PASS.
- npm run build: PASS with existing Vite large-chunk warning.
- Source review: .agents/reviews/review-20260506-201253.md, PASS WITH ISSUES, P0/P1=0.
- Broad ResearchPage test audit: .agents/reviews/test-audit-20260506-201355.md produced unrelated page-level gaps.
- Focused identitySearchProfile audit: .agents/reviews/test-audit-20260506-201619.md found pre-existing depth-inference coverage debt; filed TASK-237.
- npm run test: FAILS baseline/unrelated suite with 19 failures across ResearchPage downstream artifact counts, facetServer persistence saves, PrepPage behavior, and jdAnalysis delete semantics. AC #9 / DoD #3 intentionally left unchecked.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented TASK-196.1 schema foundation: search bank enums and labels, optional identity constraint bank fields with tolerant import warnings, SearchProfileConstraints bank fields plus remotePolicyNote, adapter mirroring from identity preferences, legacy search-state hydration defaults, additive override preservation, and field-merged identity constraints to avoid dropping bank fields on partial LLM drafts. Focused verification passes; full-suite baseline remains red outside this slice, tracked in notes.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
