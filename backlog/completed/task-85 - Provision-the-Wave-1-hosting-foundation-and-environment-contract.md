---
id: TASK-85
title: Provision the Wave 1 hosting foundation and environment contract
status: Done
assignee: []
created_date: '2026-03-13 05:28'
updated_date: '2026-03-13 12:27'
labels:
  - feature
  - infrastructure
  - billing
  - persistence
milestone: m-12
dependencies: []
documentation:
  - doc-6
  - doc-7
  - doc-8
  - doc-9
  - >-
    /Users/nferguson/Developer/resume-builder/docs/development/platform/wave-1-hosting-foundation.md
  - /Users/nferguson/Developer/resume-builder/docs/NAVIGATOR.md
  - /Users/nferguson/Developer/resume-builder/.env.example
  - /Users/nferguson/Developer/resume-builder/proxy/.env.example
  - /Users/nferguson/Developer/resume-builder/supabase/migrations/README.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Infrastructure-first slice for Wave 1. Lock the provider set, provision staging and production foundations, and define the environment, secret, migration, and webhook contract before auth, billing, and hosted persistence implementation fan out.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Wave 1 provider set for frontend hosting, backend hosting, database/auth, and billing is explicitly locked for implementation work.
- [x] #2 Staging and production infrastructure foundations are provisioned or concretely specified, including environment separation for app runtime, database/auth, and billing.
- [x] #3 The environment variable, secret ownership, database migration, and billing webhook contract is documented well enough that downstream auth, billing, and persistence tasks can implement against it.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-03-13: Started implementation-facing infrastructure contract pass in repo docs and env examples. Goal is to turn doc-9 into repo-tracked guidance covering provider lock, staging/prod separation, env ownership, migration flow, and billing webhook handling.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Locked the Wave 1 provider set in repo-tracked docs, added a concrete hosted environment and secret-ownership contract, defined staging/prod separation, documented the Supabase migration workflow and Stripe webhook expectations, and added frontend/proxy `.env.example` files to make the current and target configuration surfaces explicit.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [x] #2 Documentation has been created/modified/removed as needed.
- [ ] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [ ] #4 Test changes were approved by a test gap analysis review
- [ ] #5 Changes to integration points are covered by tests
- [ ] #6 All tests pass successfully
- [ ] #7 Automatic formatting was applied.
- [ ] #8 Linters report no WARNINGS or ERRORS
- [ ] #9 The project builds successfully
<!-- DOD:END -->
