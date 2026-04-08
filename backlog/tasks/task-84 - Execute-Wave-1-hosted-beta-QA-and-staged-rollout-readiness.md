---
id: TASK-84
title: Execute Wave 1 hosted beta QA and staged rollout readiness
status: In Progress
assignee: []
created_date: '2026-03-12 16:07'
updated_date: '2026-04-08 09:45'
labels:
  - feature
  - billing
  - persistence
  - release
milestone: m-13
dependencies:
  - TASK-81
  - TASK-82
  - TASK-83
references:
  - >-
    /Users/nick/Developer/Facet/docs/development/platform/wave-1-beta-readiness-gate.md
documentation:
  - doc-6
  - doc-7
  - doc-8
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create the final release gate for Wave 1 hosted accounts. This task should bundle staging validation, pricing and entitlement verification, persistence recovery verification, and go or no-go criteria for the first hosted beta launch.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A Wave 1 staging validation pass exists that covers hosted auth, workspace persistence, local-to-hosted migration, and AI entitlement gating.
- [x] #2 Go or no-go launch criteria are written down and include rollback conditions for persistence or billing failures.
- [x] #3 The first hosted beta rollout plan is staged, reversible, and explicitly bounded to Wave 1 scope.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-04-08: Refreshed docs/development/platform/wave-1-beta-readiness-gate.md with a current local validation snapshot. Current gate remains no-go. Fresh local receipts: npm run typecheck -> pass, npm run build -> pass. The older focused Wave 1 Vitest pack is no longer a clean release receipt because src/test/AppShell.test.tsx now fails after later shell/header changes. Launch is still blocked primarily on missing hosted staging env, Supabase JWT validation config, billing credentials, and a real staged browser validation pass.

2026-04-08: Verified the hosted env contract is now present in this checkout: browser hosted vars exist in .env/.env.production/.vercel/.env.production.local and proxy auth or billing vars exist in proxy/.env. Fresh local receipts: npm run typecheck -> pass, npm run build -> pass, and npx vitest run src/test/facetServer.test.ts src/test/billingApi.test.ts src/test/hostedAppStore.test.ts src/test/AppShell.test.tsx src/test/windowLocation.test.ts -> pass (80 passed across 5 files). Launch remains no-go because no authenticated staged browser pass, Stripe sandbox exercise, or restore/rollback rehearsal has been recorded yet.

2026-04-08: Operator reports that hosted sign-in and Stripe sandbox checkout were already validated outside this session. Those flows are no longer treated as missing setup blockers in the readiness gate. Remaining no-go items are the unrecorded hosted workspace or persistence or migration or recovery pass and the missing restore or rollback rehearsal.
<!-- SECTION:NOTES:END -->

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
