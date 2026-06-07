---
id: TASK-268.1
title: Rename identity import route surface to Identity Import
status: To Do
assignee: []
created_date: '2026-05-31 20:48'
updated_date: '2026-06-07 02:44'
labels:
  - feature
  - identity
  - copy
milestone: m-35
dependencies: []
references:
  - TODO.md
modified_files:
  - src/routes/identity/IdentityPage.tsx
  - src/components/AppShell.tsx
  - docs/user-guides/identity.md
parent_task_id: TASK-268
priority: low
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The /identity/import route is currently documented and surfaced as the import workbench in several places. TODO requests the user-facing name "Identity Import". This is a narrow copy/navigation consistency task, not a route path change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The /identity/import surface title and navigation/deep-link labels use Identity Import where the route is named to users.
- [ ] #2 The route path remains /identity/import.
- [ ] #3 Docs and tests that assert the old label are updated intentionally.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inventory user-visible labels for /identity/import across route chrome, nav, empty states, and docs.
2. Change only user-facing copy to Identity Import; do not rename the route or component unless required by tests.
3. Update focused assertions and run the relevant IdentityPage/route tests.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Regression tests pass (scoped to touched files)
- [ ] #5 Linters report no warnings or errors in touched files
- [ ] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
