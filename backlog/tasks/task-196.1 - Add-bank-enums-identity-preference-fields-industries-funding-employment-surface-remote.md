---
id: TASK-196.1
title: >-
  Add bank enums + identity preference fields (industries, funding, employment,
  surface remote)
status: To Do
assignee: []
created_date: '2026-04-29 08:41'
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
- [ ] #1 Four bank enums exported from src/types/search.ts: SearchIndustry, SearchFundingStage, SearchRemotePolicy, SearchEmploymentType, with const arrays containing the canonical members listed in doc-34 §1
- [ ] #2 Each bank ships with a display-label map (raw enum value → user-facing label)
- [ ] #3 REMOTE_POLICY_BANK values align with the existing identity.preferences.work_model.preference enum
- [ ] #4 identity.preferences.constraints extended with optional industries_to_avoid, funding_stages_acceptable, employment_types fields (backward-compatible, all optional)
- [ ] #5 SearchProfileConstraints extended with industriesToAvoid, fundingStagesAcceptable, remotePolicies, employmentTypes (camelCase per existing convention)
- [ ] #6 identitySearchProfile.adaptIdentityToSearchProfile populates the new SearchProfileConstraints fields from identity preferences
- [ ] #7 searchStore.migrateSearchState initializes the new SearchProfileConstraints fields to empty arrays for legacy persisted state
- [ ] #8 New tests cover the adapter mirroring: identity preferences → SearchProfileConstraints round-trip
- [ ] #9 Existing tests in src/test/* pass without modification
- [ ] #10 Type system rejects bank values that are not enum members
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
