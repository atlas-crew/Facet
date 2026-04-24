---
id: TASK-107.1
title: Add Identity page workspace shell and sticky header
status: Done
assignee: []
created_date: '2026-04-12 03:25'
updated_date: '2026-04-12 04:15'
labels:
  - feature
  - identity
  - ux
  - frontend
dependencies: []
references:
  - ./src/routes/identity/IdentityPage.tsx
  - ./src/routes/identity/identity.css
parent_task_id: TASK-107
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Introduce the outer Model and Strategy workspace shell on /identity without changing the internal card behaviors yet. This slice should establish the non-gated workspace structure, sticky header, and next-step CTA framing while keeping the existing cards intact.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 IdentityPage renders Model and Strategy workspace tabs, with Strategy hidden until a current identity exists.
- [x] #2 IdentityPage exposes a sticky header with one stateful primary CTA and secondary import-export actions.
- [x] #3 Existing cards remain behaviorally unchanged inside the new shell in this slice.
- [x] #4 Existing relevant identity page tests are updated for the new shell and header structure.
- [x] #5 npm run build passes for this slice.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Read current IdentityPage structure and existing identity-page tests to identify shell-level assertions that will change.
Implement a two-workspace shell in IdentityPage with Model as default and Strategy rendered only when currentIdentity exists.
Replace the current header action cluster with a sticky header containing title, status copy, one stateful primary CTA, and secondary import-export actions.
Keep existing cards intact inside Model for this slice; do not rename card headings or alter card behavior yet.
Update existing tests to match the new shell/header structure, then run targeted tests, typecheck, and build before review and commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented TASK-107.1 as a shell-only slice in IdentityPage plus supporting CSS and existing test updates.

Independent reviews: .agents/reviews/review-20260411-233600.md (blocked, remediated), .agents/reviews/review-20260412-001119.md (pass with issues; only P3 carry-forward items remain).

Verification: npx vitest run src/test/IdentityPage.test.tsx; npm run typecheck; npx eslint --no-warn-ignored src/routes/identity/IdentityPage.tsx src/test/IdentityPage.test.tsx; npm run build.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the first Identity workspace shell slice by introducing Model/Strategy top-level workspaces, a sticky stateful header CTA, conditional Strategy visibility, and updated existing IdentityPage tests to cover the new shell behavior without changing card internals.
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
