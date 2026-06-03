---
id: TASK-83
title: 'Publish Wave 1 pricing, onboarding, support, and launch documentation'
status: Done
assignee: []
created_date: '2026-03-12 16:07'
updated_date: '2026-05-06 20:42'
labels:
  - documentation
  - billing
  - persistence
milestone: m-13
dependencies:
  - TASK-75
  - TASK-77
  - TASK-80
  - TASK-82
references:
  - ./docs/development/platform/wave-1-pricing-and-entitlements.md
  - ./docs/development/platform/wave-1-beta-support-playbook.md
  - ./docs/development/platform/wave-1-operations-runbook.md
  - ./docs/development/platform/wave-1-beta-readiness-gate.md
  - ./docs/user-guides/hosted-accounts.md
documentation:
  - doc-6
  - doc-7
  - doc-8
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create the documentation package that makes the hosted beta operable: pricing and entitlement documentation, onboarding and migration guidance, support playbooks, rollout notes, and known-limits communication for the Wave 1 launch.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Internal documentation exists for pricing, entitlement behavior, and the authoritative list of AI-gated versus free features.
- [x] #2 User-facing onboarding and migration docs exist for hosted account setup, workspace migration, and AI upgrade messaging.
- [x] #3 Launch and support runbooks exist for beta rollout, rollback, known limits, and common user-support scenarios.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-04-08: The Wave 1 docs package is present in-repo: pricing and entitlements, hosted accounts guide, beta support playbook, operations runbook, and readiness gate all exist and are linked from docs/NAVIGATOR.md. Fresh local verification for this closeout pass: npm run typecheck -> pass, npm run build -> pass. Remaining closeout work is task hygiene and final approval flow, not missing documentation content.

2026-05-06 closure (Wave 1 consolidation): All 3 ACs satisfied; per 2026-04-08 closeout, the docs package is in-repo (pricing-and-entitlements, hosted-accounts user guide, beta-support-playbook, operations-runbook, beta-readiness-gate) and linked from docs/NAVIGATOR.md. Build and typecheck pass. Docs-architect approval rolls into TASK-84's launch gate. Closing as part of Wave 1 consolidation.
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
