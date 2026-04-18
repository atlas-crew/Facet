---
id: TASK-112
title: Restore obvious skill depth wizard entry on Identity page
status: Done
assignee: []
created_date: '2026-04-12 14:25'
updated_date: '2026-04-18 20:24'
labels:
  - bug
  - identity
  - frontend
  - ux
dependencies: []
references:
  - /Users/nick/Developer/Facet/src/routes/identity/IdentityPage.tsx
  - /Users/nick/Developer/Facet/src/test/IdentityPage.test.tsx
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make the Identity page keep a visible, recognizable entry point back into the skill depth wizard even when a draft is present.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Identity page shows a visible skill enrichment entry whenever there is a current identity with enrichable skills, even if a draft also exists.
- [x] #2 The CTA copy makes it clear that the route leads to the skill depth wizard.
- [x] #3 Relevant Identity page tests, typecheck, and build pass.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed TASK-112 after verifying the Identity page already ships a persistent Skill Enrichment banner and an explicit 'Open Skill Depth Wizard' CTA even when a draft exists alongside the current identity.
No code change was required for this task; the backlog entry had gone stale while the shipped IdentityPage implementation and regression coverage already satisfied the acceptance criteria.
Verification:
- npx vitest run src/test/IdentityPage.test.tsx -t "shows the enrichment banner counts and CTA when an identity model exists|keeps the skill depth wizard entry visible when a draft exists alongside the current identity"
- npx eslint src/routes/identity/IdentityPage.tsx src/test/IdentityPage.test.tsx
- npm run typecheck
- npm run build
Note: the full IdentityPage test file currently has one unrelated export-fixture failure tied to identity export content drift. That issue was not part of TASK-112 and was treated as non-gating for closing this stale task.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
