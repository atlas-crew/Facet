---
id: TASK-102.4
title: Add search vector generation and review editor in IdentityPage
status: Done
assignee: []
created_date: '2026-04-11 06:14'
updated_date: '2026-04-12 01:36'
labels:
  - feature
  - identity
  - research
milestone: m-16
dependencies:
  - TASK-102.11
  - TASK-102.12
references:
  - src/routes/identity/IdentityPage.tsx
  - src/store/identityStore.ts
  - src/utils/jobMatch.ts
documentation:
  - main/facet/identity-to-parameters-doc-spec
  - main/facet/professional-identity-schema-v3-1
  - main/facet/generator-rules-accuracy-gap-in-v3-1
parent_task_id: TASK-102
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the search vector editor as an identity-native generation plus review workflow. Users should explicitly trigger vector generation from settled identity material, review evidence-backed vector proposals, and accept, edit, or reject them before they become durable identity data.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Users can trigger vector generation from the current identity model from within IdentityPage.
- [ ] #2 Each generated vector displays the supporting identity evidence it was derived from and persists a needs-review state until explicitly touched.
- [ ] #3 Accepted and edited vectors write back into identity.search_vectors with full CRUD support.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Execution note: this task shares the same IdentityPage editor surface as TASK-102.3 and TASK-102.5. Treat the three tasks as close-sequence work owned by the same person or tightly coordinated team even though the formal dependency graph does not force serial execution.

Correction note: vector regeneration must consume persisted generator_rules.accuracy constraints so previously corrected factual mistakes are not reintroduced on regeneration.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
