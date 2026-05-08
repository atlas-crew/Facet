---
id: TASK-102.10
title: Decide schema placement for interview process criteria
status: Done
assignee: []
created_date: '2026-04-11 07:15'
updated_date: '2026-04-12 01:36'
labels:
  - refactor
  - identity
  - research
milestone: m-16
dependencies: []
references:
  - src/identity/schema.ts
  - src/routes/identity/IdentityPage.tsx
  - src/store/identityStore.ts
documentation:
  - main/facet/identity-to-parameters-doc-spec
  - main/facet/professional-identity-schema-v3-1
parent_task_id: TASK-102
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Resolve the open schema question for interview-process criteria before structured strategic-preferences editing begins. Decide whether interview criteria belongs under preferences, another structured identity field, or should be explicitly excluded from the current schema scope, then implement the schema and validation updates needed for downstream editing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The schema location and representation for interview-process criteria is explicitly decided and documented.
- [ ] #2 If interview-process criteria belongs in schema scope, the field shape, validation, and persistence path are implemented before downstream editor work starts.
- [ ] #3 If interview-process criteria is out of scope for the structured schema, TASK-102.3 is updated to reflect that explicit decision instead of leaving the question open.
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
