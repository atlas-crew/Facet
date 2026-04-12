---
id: TASK-102.11
title: Add needs-review marker infrastructure for AI-derived identity items
status: Done
assignee: []
created_date: '2026-04-11 07:15'
updated_date: '2026-04-12 01:36'
labels:
  - feature
  - identity
  - research
milestone: m-16
dependencies: []
references:
  - src/store/identityStore.ts
  - src/routes/identity/IdentityPage.tsx
  - src/identity/schema.ts
documentation:
  - main/facet/identity-to-parameters-doc-spec
  - main/facet/generator-rules-accuracy-gap-in-v3-1
parent_task_id: TASK-102
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the shared state, persistence, and UI primitives for AI-derived identity items that require explicit user review. Search vector generation and awareness generation should both consume the same needs-review infrastructure instead of inventing separate marker logic.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 AI-derived identity items can persist a needs-review state until the user explicitly touches them.
- [ ] #2 The UI can surface needs-review counts consistently for multiple strategic field editors.
- [ ] #3 Search vector and awareness generation flows can consume the same shared needs-review primitive.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scope note: needs-review markers track review state only. They do not replace generator_rules.accuracy or any other persistence layer for factual correction constraints.
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
