---
id: TASK-107.3
title: Demote Identity inspection panels and polish model workspace hierarchy
status: Done
assignee: []
created_date: '2026-04-12 03:25'
updated_date: '2026-04-12 05:42'
labels:
  - feature
  - identity
  - ux
  - frontend
dependencies: []
references:
  - ./src/routes/identity/IdentityPage.tsx
  - ./src/routes/identity/BulletConfidenceCard.tsx
  - ./src/routes/identity/DraftSummaryCard.tsx
  - ./src/routes/identity/identity.css
parent_task_id: TASK-107
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reduce the visual prominence of secondary inspection surfaces so the Model workspace stays focused on the main authoring flow. Reposition confidence and changelog views as secondary panels and tighten status messaging and layout polish after the shell and card reframing land.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Confidence and changelog surfaces are rendered as secondary inspection panels rather than peer workflow destinations.
- [x] #2 Model workspace sections communicate local readiness or status without becoming a stepper.
- [x] #3 Layout and spacing remain usable on desktop and mobile after the hierarchy changes.
- [x] #4 Existing relevant page or panel tests are updated for the new prominence and labels.
- [x] #5 npm run build passes for this slice.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started TASK-107.3 after committing TASK-107.2 (refactor(identity): reframe workspace copy).

Completed hierarchy polish and secondary-panel demotion in commit 998eabd, then landed follow-up accessibility and maintainability cleanup in ad75234.

Independent source reviews: .agents/reviews/review-20260412-005858.md, .agents/reviews/review-20260412-010439.md, and later iterations through .agents/reviews/review-20260412-013843.md. The latest review before final cleanup was pass-with-issues with only maintainability guidance; final targeted cleanup was locally re-verified.

Test audit: .agents/reviews/test-audit-20260412-011717.md. Broad IdentityPage coverage gaps remain, but the updated shell/panel/status behaviors exercised by this slice are covered by src/test/IdentityPage.test.tsx.

Verification: npx prettier --write src/routes/identity/ExtractionAgentCard.tsx src/routes/identity/IdentityModelBuilderCard.tsx src/routes/identity/BulletConfidenceCard.tsx src/routes/identity/DraftSummaryCard.tsx src/routes/identity/IdentityPage.tsx; npx vitest run src/test/IdentityPage.test.tsx; npm run typecheck; npx eslint --no-warn-ignored src/routes/identity/ExtractionAgentCard.tsx src/routes/identity/IdentityModelBuilderCard.tsx src/routes/identity/BulletConfidenceCard.tsx src/routes/identity/DraftSummaryCard.tsx src/routes/identity/IdentityPage.tsx src/routes/identity/identity.css src/test/IdentityPage.test.tsx; npm run build.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Demoted Confidence Review and What Changed into a dedicated Inspection Panels region beneath the main Model workbench, added local readiness/status messaging to the primary cards, and tightened the secondary-card presentation so the page hierarchy stays model-first without becoming a stepper. Follow-up polish in ad75234 also cleaned up the inspection-panel semantics and status treatment, including a single authoritative header live region, semantic inline status badges, heading hierarchy fixes, and builder-editor reset behavior that preserves parent-owned draft JSON while resetting panel visibility for new drafts.

Verification: npx vitest run src/test/IdentityPage.test.tsx; npm run typecheck; npx eslint --no-warn-ignored src/routes/identity/ExtractionAgentCard.tsx src/routes/identity/IdentityModelBuilderCard.tsx src/routes/identity/BulletConfidenceCard.tsx src/routes/identity/DraftSummaryCard.tsx src/routes/identity/IdentityPage.tsx src/routes/identity/identity.css src/test/IdentityPage.test.tsx; npm run build.
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
