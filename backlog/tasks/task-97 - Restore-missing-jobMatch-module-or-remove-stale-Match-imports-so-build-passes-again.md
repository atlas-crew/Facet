---
id: TASK-97
title: >-
  Restore missing jobMatch module or remove stale Match imports so build passes
  again
status: Done
assignee: []
created_date: '2026-04-08 16:54'
updated_date: '2026-05-06 23:49'
labels:
  - build
  - match
  - wave-1
dependencies: []
references:
  - ./src/routes/match/MatchPage.tsx
  - ./src/store/matchStore.ts
  - ./src/test/jobMatch.test.ts
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

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Stale task. Verified 2026-05-06 that `src/utils/jobMatch.ts` is present (67KB), all import sites (`MatchPage.tsx`, `matchStore.ts`, `jobMatch.test.ts`) resolve, and `npm run build` exits clean. The "missing module" problem this task was filed to address (2026-04-08) was resolved at some point during the JD-analysis consolidation / audience-tagging foundation work — it's no longer present. Closing without code changes; both AC met by current repo state. Verification commands run: `ls src/utils/jobMatch.ts` (exists), `grep -l 'jobMatch' …` (all sites resolve), `npm run build` (✓ built in 10.28s).
<!-- SECTION:FINAL_SUMMARY:END -->

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
