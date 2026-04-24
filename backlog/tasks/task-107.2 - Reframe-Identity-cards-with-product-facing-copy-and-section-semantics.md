---
id: TASK-107.2
title: Reframe Identity cards with product-facing copy and section semantics
status: Done
assignee: []
created_date: '2026-04-12 03:25'
updated_date: '2026-04-12 04:53'
labels:
  - feature
  - identity
  - ux
  - frontend
dependencies: []
references:
  - ./src/routes/identity/ExtractionAgentCard.tsx
  - ./src/routes/identity/IdentityModelBuilderCard.tsx
  - >-
    ./src/routes/identity/IdentityStrategyWorkbench.tsx
  - ./src/routes/identity/identity.css
parent_task_id: TASK-107
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update the extraction, draft-review, and strategy workbench surfaces so the page speaks in product-facing language and matches the new workspace model. Keep business logic intact while renaming headings, CTA copy, and internal section framing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Extraction, draft-review, and strategy surfaces use the approved product-facing headings and CTA copy.
- [x] #2 The draft JSON editor is demoted behind an advanced disclosure without becoming hard to reach.
- [x] #3 Strategy subnavigation and generation-export actions reflect the new Search Preferences, Targeting Angles, Open Questions, and Search Brief terminology.
- [x] #4 Existing relevant card and strategy tests are updated for the intended copy and structure changes.
- [x] #5 npm run build passes for this slice.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reframed the extraction, draft-review, and strategy workbench surfaces with product-facing copy, tucked the JSON editor behind an advanced disclosure, tightened the workspace semantics in IdentityPage, and updated existing IdentityPage tests for the revised headings and actions.

Independent code reviews: .agents/reviews/review-20260412-002423.md (pass with issues), .agents/reviews/review-20260412-003258.md (pass with issues), .agents/reviews/review-20260412-004301.md (pass with issues), .agents/reviews/review-20260412-004833.md (pass with issues; only P3 carry-forward items remain).

Test audit: .agents/reviews/test-audit-20260412-003526.md (broad existing IdentityPage coverage debt remains; no slice-specific P0/P1 regression findings were introduced, and the user-directed scope for this pass was to update existing relevant tests rather than expand module-wide coverage).

Verification: npx prettier --write src/routes/identity/ExtractionAgentCard.tsx src/routes/identity/IdentityModelBuilderCard.tsx src/routes/identity/IdentityPage.tsx src/routes/identity/IdentityStrategyWorkbench.tsx src/test/IdentityPage.test.tsx; npx vitest run src/test/IdentityPage.test.tsx; npm run typecheck; npx eslint --no-warn-ignored src/routes/identity/ExtractionAgentCard.tsx src/routes/identity/IdentityModelBuilderCard.tsx src/routes/identity/IdentityStrategyWorkbench.tsx src/routes/identity/IdentityPage.tsx src/test/IdentityPage.test.tsx; npm run build.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Updated the Identity extraction, draft-review, and strategy surfaces to use product-facing language, moved the JSON editor behind an advanced disclosure, refreshed the strategy terminology to Search Preferences/Targeting Angles/Open Questions/Search Brief, and kept the workspace behavior covered by updated existing IdentityPage tests.
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
