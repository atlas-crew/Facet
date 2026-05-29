---
id: TASK-266.1
title: Add auth-aware root split and public landing shell
status: To Do
assignee: []
created_date: '2026-05-29 00:20'
labels:
  - feature
  - landing
  - auth
dependencies: []
references:
  - src/routes/home/HomePage.tsx
  - src/components/AppShell.tsx
documentation:
  - doc-44
parent_task_id: TASK-266
priority: medium
ordinal: 10000
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Root route renders a standalone public landing shell for anonymous/hosted auth-required visitors.
- [ ] #2 Authenticated users with workspace access continue to see the existing Home/Overview hub at /.
- [ ] #3 Public landing chrome is separate from the authenticated AppShell unless an explicit product decision says otherwise.
- [ ] #4 Route/auth-state tests cover anonymous, auth-required, and authenticated hub cases.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect current AppShell hosted auth gate, HomePage route wiring, and hostedAppStore bootstrap states.\n2. Add a public landing component/shell and route selection logic for /.\n3. Preserve HomePage for authenticated users and avoid changing sidebar taxonomy.\n4. Add focused tests for the root auth split and run scoped verification.
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
