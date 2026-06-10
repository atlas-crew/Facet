---
id: TASK-84
title: Execute Wave 1 hosted beta QA and staged rollout readiness
status: Done
assignee:
  - '@codex'
created_date: '2026-03-12 16:07'
updated_date: '2026-05-24 16:33'
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
  - ./docs/development/platform/wave-1-beta-readiness-gate.md
documentation:
  - doc-6
  - doc-7
  - doc-8
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create the final release gate for Wave 1 hosted accounts. This task should bundle staging validation, pricing and entitlement verification, persistence recovery verification, and go or no-go criteria for the first hosted beta launch.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A Wave 1 staging validation pass exists that covers hosted auth, workspace persistence, local-to-hosted migration, and AI entitlement gating.
- [x] #2 Go or no-go launch criteria are written down and include rollback conditions for persistence or billing failures.
- [x] #3 The first hosted beta rollout plan is staged, reversible, and explicitly bounded to Wave 1 scope.
- [x] #4 Hosted sync states (saving / saved / offline / error) verified against authoritative hosted runtime in staging (rolled up from TASK-81 AC #1).
- [x] #5 Entitlement-related failures and upgrade-required states surfaced distinctly from generic sync/persistence failures, verified in staging (rolled up from TASK-81 AC #2).
- [x] #6 Recoverable paths verified end-to-end in staging: retry, re-auth, and non-destructive fallback to local export/import (rolled up from TASK-81 AC #3).
- [x] #7 Docs-architect approval (8/10) recorded for the consolidated Wave 1 docs package (pricing-and-entitlements, hosted-accounts, beta-support-playbook, operations-runbook, beta-readiness-gate) — rolled up from TASK-80/82/83 DoD.
- [x] #8 Restore / rollback rehearsal recorded against hosted persistence (workspace restore from snapshot, billing rollback to local-mode fallback).
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-04-08: Refreshed docs/development/platform/wave-1-beta-readiness-gate.md with a current local validation snapshot. Current gate remains no-go. Fresh local receipts: npm run typecheck -> pass, npm run build -> pass. The older focused Wave 1 Vitest pack is no longer a clean release receipt because src/test/AppShell.test.tsx now fails after later shell/header changes. Launch is still blocked primarily on missing hosted staging env, Supabase JWT validation config, billing credentials, and a real staged browser validation pass.

2026-04-08: Verified the hosted env contract is now present in this checkout: browser hosted vars exist in .env/.env.production/.vercel/.env.production.local and proxy auth or billing vars exist in proxy/.env. Fresh local receipts: npm run typecheck -> pass, npm run build -> pass, and npx vitest run src/test/facetServer.test.ts src/test/billingApi.test.ts src/test/hostedAppStore.test.ts src/test/AppShell.test.tsx src/test/windowLocation.test.ts -> pass (80 passed across 5 files). Launch remains no-go because no authenticated staged browser pass, Stripe sandbox exercise, or restore/rollback rehearsal has been recorded yet.

2026-04-08: Operator reports that hosted sign-in and Stripe sandbox checkout were already validated outside this session. Those flows are no longer treated as missing setup blockers in the readiness gate. Remaining no-go items are the unrecorded hosted workspace or persistence or migration or recovery pass and the missing restore or rollback rehearsal.

2026-05-06 Wave 1 consolidation: TASK-80, 81, 82, 83 closed Done. Their engineering and docs shipped between 2026-03-14 and 2026-04-08 per their respective notes; what remained were operator-action gates (docs-architect approval, hosted staging env, Stripe sandbox rehearsal, restore/rollback drill). Those gates are now consolidated here as the single holder for Wave 1 launch readiness. Five ACs added covering: TASK-81's three sync/entitlement/recovery verifications (rolled up unticked because the original agent never formally verified them — staging pass is the right place to do that once), docs-architect signoff on the consolidated docs package, and the missing restore/rollback rehearsal. Priority lowered to Low because Facet is pre-launch with no users; this task is dormant until a hosted-beta launch is actually scheduled. Existing dependencies on the now-closed sibling tasks are preserved for history but are effectively satisfied.

2026-05-24 Codex taking TASK-84 for final Wave 1 readiness execution. Plan: verify live hosted frontend/API/Supabase/Fly state; run staged hosted auth, persistence, migration/import, entitlement-denial, checkout/refund, restore, and rollback evidence where safe; update readiness docs/task with go/no-go decision and concrete receipts; request docs-architect review for the consolidated docs package if docs are changed.

2026-05-24 Codex progress: fixed hosted workspace default snapshot blocker discovered during TASK-84 staging validation. Commit 96bd228 centralizes hosted snapshot defaults, adds jdAnalysis/current resume/cover-letter/research shapes, normalizes legacy hosted snapshots on read, updates the example hosted workspace file, and adds the SPA rewrite config. Verification: pnpm exec vitest run src/test/hostedWorkspaceStore.test.ts src/test/facetServer.test.ts (73 passed); scoped ESLint passed; git diff --check passed; pnpm run build passed with existing chunk-size warnings; independent review artifacts .agents/reviews/review-20260524-110527.md, review-20260524-110946.md, review-20260524-111323.md informed remediation; deployed Fly facet-api image REDACTED-DEPLOY-ID; live Supabase-session smoke against https://REDACTED-API-HOST passed create workspace -> immediate generated snapshot save (revision 1, jdAnalysis revision 1) -> invalid pipeline payload returns 400 -> delete returns 200. Remaining TASK-84 blocker: Vercel frontend deploy failed because the configured Vercel token is invalid; https://myfacets.cv/account and https://REDACTED-VERCEL-HOST/account still return Vercel 404 until the SPA rewrite is deployed.

2026-05-24 Vercel follow-up: pushed main to origin with cortex git push. Vercel production deployment REDACTED-VERCEL-DPL (https://REDACTED-VERCEL-DEPLOY-HOST) built Ready and aliases include https://myfacets.cv and https://REDACTED-VERCEL-HOST. Direct route checks now pass: https://myfacets.cv/account -> HTTP 200 index.html; https://REDACTED-VERCEL-HOST/account -> HTTP 200 index.html. The raw deployment URL is protected by Vercel SSO and returns 401, but production aliases serve correctly.

2026-05-24 final TASK-84 validation: committed docs(platform): record wave 1 beta validation (1df74a2) and lint baseline cleanup (86a8709). Live hosted API receipt /tmp/facet-task84-final-live.json passed 30/30 checks against https://REDACTED-API-HOST, Supabase project REDACTED-SUPABASE-REF, Vercel aliases https://myfacets.cv and https://REDACTED-VERCEL-HOST, and Fly image REDACTED-DEPLOY-ID. Browser receipt /tmp/facet-task84-browser.json passed 3/3 checks and rendered authenticated /account at https://myfacets.cv. Docs receipt recorded in docs/development/platform/wave-1-beta-validation-2026-05-24.md; readiness gate now records go decision. Docs-architect artifact .agents/reviews/docs-architect-task84-20260524-122922.md approved 9/10. Test-gap audit artifact .agents/reviews/test-audit-20260524-123130.md found no behavioral test gaps for the docs-only diff. Verification: pnpm run test:wave1 -> 5 files, 164 tests passed; pnpm run format:files:check on changed files -> pass; pnpm run lint -> pass; pnpm run build -> pass with existing chunk-size warnings; git diff --check -> pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Wave 1 hosted beta readiness is complete and marked go for the bounded beta scope. The final pass recorded live hosted auth, workspace persistence, sync saved/error/offline states, retry/re-auth/local export-import recovery, AI entitlement denial reasons, paid-pass activation, restore from known-good snapshot, and billing rollback fallback. Documentation now includes the 2026-05-24 validation receipt and aligned AI feature inventory; docs-architect approved the consolidated package at 9/10. Verification passed for Wave 1 tests, formatting, lint, build, and diff whitespace.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Documentation has been created/modified/removed as needed.
- [x] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [x] #4 Test changes were approved by a test gap analysis review
- [x] #5 Changes to integration points are covered by tests
- [x] #6 All tests pass successfully
- [x] #7 Automatic formatting was applied.
- [x] #8 Linters report no WARNINGS or ERRORS
- [x] #9 The project builds successfully
<!-- DOD:END -->
