---
id: TASK-75
title: 'Define the Wave 1 auth, billing, entitlement, and workspace domain contract'
status: Done
assignee: []
created_date: '2026-03-12 16:06'
updated_date: '2026-03-13 16:00'
labels:
  - feature
  - auth
  - billing
  - persistence
milestone: m-12
dependencies:
  - TASK-85
documentation:
  - doc-5
  - doc-6
  - doc-8
  - doc-9
  - >-
    /Users/nferguson/Developer/resume-builder/docs/development/platform/wave-1-domain-contract.md
  - /Users/nferguson/Developer/resume-builder/src/types/hosted.ts
  - /Users/nferguson/Developer/resume-builder/src/utils/aiAccess.ts
  - /Users/nferguson/Developer/resume-builder/src/test/aiAccess.test.ts
  - /Users/nferguson/Developer/resume-builder/docs/NAVIGATOR.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Turn the existing tenant-aware persistence foundation into a concrete Wave 1 contract for hosted single-user accounts. Lock the account, tenant, user, workspace, billing, and entitlement model early enough that hosted persistence and AI gating do not drift into incompatible implementations.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Wave 1 server-side domain model for account, tenant, user, workspace, billing customer, and entitlement state is documented and reflected in implementation-facing contracts.
- [x] #2 The list of AI-enabled features that require paid entitlement is explicitly defined, along with the free standard feature boundary.
- [x] #3 The authoritative entitlement-check path and failure-state behavior are defined for both proxy-side AI requests and client-side gating.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-03-13 product decision: support AI access for full self-hosted Facet deployments that run their own proxy and provide their own model keys. Do not support hosted-app plus customer BYOK. Domain contract should distinguish hosted paid AI from self-hosted operator-managed AI access and explicitly mark hosted+BYOK as unsupported.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Defined the Wave 1 hosted account, billing, entitlement, and workspace contract in repo-tracked docs and implementation-facing TypeScript. The contract now explicitly distinguishes hosted paid AI from full self-hosted operator-managed AI, marks hosted-app plus customer BYOK as unsupported, enumerates the paid AI feature set, and captures the authoritative hosted-vs-self-hosted access decision in a tested helper.
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
