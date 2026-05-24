---
id: TASK-96
title: Broaden hosted entitlement billing tests to exercise real AI denial flows
status: In Progress
assignee:
  - '@codex'
created_date: '2026-04-08 16:54'
updated_date: '2026-05-24 13:59'
labels:
  - tests
  - wave-1
  - hosted
milestone: m-13
dependencies:
  - TASK-240
  - TASK-241
  - TASK-242
references:
  - ./.agents/reviews/test-audit-20260408-124654.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Independent audit still flags shallow or missing AI-request coverage in hosted entitlement tests. The current suite verifies workspace and billing-state recovery, but it does not reliably trigger and assert the actual JD-analysis denial UX for upgrade_required and billing_issue paths.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Trigger a real JD-analysis request in hosted entitlement tests and assert the success path reaches the AI endpoint.
- [x] #2 Trigger upgrade_required denial and assert the user-visible denial UX, not just account-state labels.
- [x] #3 Trigger billing_issue denial and assert the user-visible denial UX, not just account-state labels.
- [x] #4 Verify Refresh Billing State behavior or replace it with a more testable recovery contract.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Codex taking TASK-96. First loop: inspect hosted entitlement/JD-analysis tests against the pass lifecycle from TASK-242, add local regression coverage for real AI success and denial UX where feasible, then run focused/full gates and independent test audit.

Implemented and committed as test(hosted): exercise entitlement denial flows. Hosted entitlement Playwright coverage now seeds a Pipeline entry plus identity, clicks the real Analyze JD UI, asserts a match.jd-analysis AI proxy request reaches the endpoint on success, asserts user-visible upgrade_required and billing_issue denial alerts, and verifies Refresh Billing State reload recovery. Verification: VITE_FACET_DEPLOYMENT_MODE=hosted npx playwright test tests/hosted/entitlement-billing.spec.ts --project=hosted passed (9 tests); pnpm typecheck passed; scoped eslint for touched hosted files passed; pnpm test passed (173 files / 2451 tests); pnpm build passed with existing chunk-size warning; git diff --check passed. Independent test audit: .agents/reviews/test-audit-20260524-095707.md via Gemini fallback after Claude emitted malformed output; P0/P1/P2 gaps = 0. Full pnpm lint remains blocked by pre-existing unrelated baseline errors in src/hooks/useElapsed.ts, src/routes/identity/inspectorSlots/slotPrimitives.tsx, and tests/hosted/diag.spec.ts, so DoD #8 is intentionally left unchecked.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
TASK-96 acceptance coverage is implemented and committed. The hosted entitlement spec now drives the real Pipeline JD-analysis button for success, upgrade_required denial, billing_issue denial, and Refresh Billing State recovery. Focused hosted Playwright, typecheck, scoped lint, full Vitest, build, diff check, and independent test audit passed. Full repo lint remains blocked by unrelated baseline lint errors outside this task's files.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Documentation has been created/modified/removed as needed.
- [ ] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [x] #4 Test changes were approved by a test gap analysis review
- [x] #5 Changes to integration points are covered by tests
- [x] #6 All tests pass successfully
- [x] #7 Automatic formatting was applied.
- [ ] #8 Linters report no WARNINGS or ERRORS
- [x] #9 The project builds successfully
<!-- DOD:END -->
