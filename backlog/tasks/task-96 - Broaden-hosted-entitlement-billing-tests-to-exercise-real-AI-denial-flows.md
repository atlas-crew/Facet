---
id: TASK-96
title: Broaden hosted entitlement billing tests to exercise real AI denial flows
status: In Progress
assignee:
  - '@codex'
created_date: '2026-04-08 16:54'
updated_date: '2026-05-24 13:45'
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
- [ ] #1 Trigger a real JD-analysis request in hosted entitlement tests and assert the success path reaches the AI endpoint.
- [ ] #2 Trigger upgrade_required denial and assert the user-visible denial UX, not just account-state labels.
- [ ] #3 Trigger billing_issue denial and assert the user-visible denial UX, not just account-state labels.
- [ ] #4 Verify Refresh Billing State behavior or replace it with a more testable recovery contract.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Codex taking TASK-96. First loop: inspect hosted entitlement/JD-analysis tests against the pass lifecycle from TASK-242, add local regression coverage for real AI success and denial UX where feasible, then run focused/full gates and independent test audit.
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
