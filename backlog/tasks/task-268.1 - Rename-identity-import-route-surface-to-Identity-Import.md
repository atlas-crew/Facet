---
id: TASK-268.1
title: Rename identity import route surface to Identity Import
status: Done
assignee: []
created_date: '2026-05-31 20:48'
updated_date: '2026-06-07 04:52'
labels:
  - feature
  - identity
  - copy
milestone: m-35
dependencies: []
references:
  - TODO.md
modified_files:
  - src/routes/identity/IdentityMapPage.tsx
  - src/routes/identity/IdentityPage.tsx
  - docs/user-guides/identity.md
  - src/test/IdentityMapEditing.test.tsx
  - src/test/IdentityMapPage.deepLink.test.tsx
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
- [x] #1 The /identity/import surface title and navigation/deep-link labels use Identity Import where the route is named to users.
- [x] #2 The route path remains /identity/import.
- [x] #3 Docs and tests that assert the old label are updated intentionally.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inventory user-visible labels for /identity/import across route chrome, nav, empty states, and docs.
2. Change only user-facing copy to Identity Import; do not rename the route or component unless required by tests.
3. Update focused assertions and run the relevant IdentityPage/route tests.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Renamed the user-facing /identity/import surface to Identity Import without changing the route. Updated the Identity Map import CTAs, import page heading, user guide references, and focused tests covering the renamed affordances.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 Automatic formatting was applied to touched files
- [x] #4 Regression tests pass (scoped to touched files)
- [x] #5 Linters report no warnings or errors in touched files
- [x] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
