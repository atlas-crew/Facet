---
id: TASK-266.1
title: Add auth-aware root split and public landing shell
status: Done
assignee:
  - '@codex'
created_date: '2026-05-29 00:20'
updated_date: '2026-05-29 01:01'
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
modified_files:
  - src/components/AppShell.tsx
  - src/routes/public/PublicLandingPage.tsx
  - src/routes/public/publicLanding.css
  - src/test/AppShell.test.tsx
  - src/test/PublicLandingPage.test.tsx
parent_task_id: TASK-266
priority: medium
ordinal: 10000
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Root route renders a standalone public landing shell for anonymous/hosted auth-required visitors.
- [x] #2 Authenticated users with workspace access continue to see the existing Home/Overview hub at /.
- [x] #3 Public landing chrome is separate from the authenticated AppShell unless an explicit product decision says otherwise.
- [x] #4 Route/auth-state tests cover anonymous, auth-required, and authenticated hub cases.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect current AppShell hosted auth gate, HomePage route wiring, and hostedAppStore bootstrap states.\n2. Add a public landing component/shell and route selection logic for /.\n3. Preserve HomePage for authenticated users and avoid changing sidebar taxonomy.\n4. Add focused tests for the root auth split and run scoped verification.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Starting route/auth split and public landing shell.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented hosted auth-aware root split: signed-out hosted visits to / now render a standalone public landing page, while authenticated and non-root hosted states keep the existing workspace shell/sign-in blockers. Added route/auth tests.
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
