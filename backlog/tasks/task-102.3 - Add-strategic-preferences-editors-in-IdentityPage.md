---
id: TASK-102.3
title: Add strategic preferences editors in IdentityPage
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
  - TASK-102.10
references:
  - src/routes/identity/IdentityPage.tsx
  - src/routes/identity/ScannedIdentityEditor.tsx
  - src/store/identityStore.ts
  - src/identity/schema.ts
documentation:
  - main/facet/identity-to-parameters-doc-spec
  - main/facet/professional-identity-schema-v3-1
parent_task_id: TASK-102
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add structured editing surfaces in IdentityPage for user-precommitment strategic fields: preferences.constraints and preferences.matching, plus any schema-backed interview-process criteria needed for the parameters-doc shape. This work should avoid raw-JSON-only editing for those fields.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 IdentityPage exposes structured editors for preferences.constraints and preferences.matching instead of requiring raw JSON edits.
- [ ] #2 If interview-process criteria needs a new schema location, that schema decision and persistence path are implemented as part of this task.
- [ ] #3 Validation and store updates prevent malformed strategic preference data from being applied silently.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Execution note: this task shares the same IdentityPage editor surface as TASK-102.4 and TASK-102.5. Treat the three tasks as close-sequence work owned by the same person or tightly coordinated team even though the formal dependency graph does not force serial execution.
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
