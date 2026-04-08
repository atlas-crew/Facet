---
id: TASK-97
title: >-
  Restore missing jobMatch module or remove stale Match imports so build passes
  again
status: To Do
assignee: []
created_date: '2026-04-08 16:54'
labels:
  - build
  - match
  - wave-1
dependencies: []
references:
  - /Users/nick/Developer/Facet/src/routes/match/MatchPage.tsx
  - /Users/nick/Developer/Facet/src/store/matchStore.ts
  - /Users/nick/Developer/Facet/src/test/jobMatch.test.ts
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The repo-wide build currently fails before Playwright can start its config.webServer path because src/utils/jobMatch is missing while MatchPage, matchStore, and jobMatch.test.ts still import it. This is unrelated to the hosted fixture fixes, but it blocks the exact non-reuse hosted Playwright command.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 npm run build passes without missing-module or implicit-any errors from jobMatch paths.
- [ ] #2 VITE_FACET_DEPLOYMENT_MODE=hosted npx playwright test --project=hosted-auth-setup --project=hosted starts its config.webServer path without build-time failure.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Documentation has been created/modified/removed as needed.
- [ ] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [ ] #4 Test changes were approved by a test gap analysis review
- [ ] #5 Changes to integration points are covered by tests
- [ ] #6 All tests pass successfully
- [ ] #7 Automatic formatting was applied.
- [ ] #8 Linters report no WARNINGS or ERRORS
- [ ] #9 The project builds successfully
<!-- DOD:END -->
