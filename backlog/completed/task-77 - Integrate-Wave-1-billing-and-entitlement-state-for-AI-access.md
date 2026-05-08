---
id: TASK-77
title: Integrate Wave 1 billing and entitlement state for AI access
status: Done
assignee: []
created_date: '2026-03-12 16:06'
updated_date: '2026-03-13 21:54'
labels:
  - feature
  - billing
  - auth
milestone: m-12
dependencies:
  - TASK-75
  - TASK-76
  - TASK-85
documentation:
  - doc-6
  - doc-7
  - doc-8
  - doc-9
  - /Users/nferguson/Developer/resume-builder/proxy/billingApi.js
  - /Users/nferguson/Developer/resume-builder/proxy/billingState.js
  - /Users/nferguson/Developer/resume-builder/proxy/hosted-billing.example.json
  - /Users/nferguson/Developer/resume-builder/proxy/.env.example
  - /Users/nferguson/Developer/resume-builder/proxy/facetServer.js
  - /Users/nferguson/Developer/resume-builder/src/types/hosted.ts
  - /Users/nferguson/Developer/resume-builder/src/utils/hostedAccountClient.ts
  - /Users/nferguson/Developer/resume-builder/src/test/billingApi.test.ts
  - >-
    /Users/nferguson/Developer/resume-builder/docs/development/platform/wave-1-domain-contract.md
  - >-
    /Users/nferguson/Developer/resume-builder/docs/development/platform/wave-1-hosting-foundation.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the first billing path for hosted Facet so AI-enabled functionality can be paywalled while standard features remain free. This should establish the billing provider integration, customer/plan linkage, and server-authoritative entitlement status used by the rest of Wave 1.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A Wave 1 billing provider integration exists for creating or linking a billing customer to a hosted account.
- [x] #2 Server-side entitlement state is persisted and can represent at least active, inactive, trial, grace, and delinquent AI access states.
- [x] #3 The billing and entitlement contract is exposed in a way that downstream proxy and client gating can consume without trusting client-authored entitlement claims.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the first hosted billing path for Wave 1. Hosted mode now exposes a server-authored account context API, a Stripe-backed billing customer create/link route, and a subscription checkout-session route for the paid AI plan. Billing customer, subscription, and entitlement state are persisted in a durable hosted billing directory with explicit support for inactive, trial, active, grace, and delinquent states, and typed client helpers now expose the contract for downstream gating without trusting client-authored entitlement claims.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Documentation has been created/modified/removed as needed.
- [ ] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [ ] #4 Test changes were approved by a test gap analysis review
- [ ] #5 Changes to integration points are covered by tests
- [ ] #6 All tests pass successfully
- [ ] #7 Automatic formatting was applied.
- [ ] #8 Linters report no WARNINGS or ERRORS
- [x] #9 The project builds successfully
<!-- DOD:END -->
