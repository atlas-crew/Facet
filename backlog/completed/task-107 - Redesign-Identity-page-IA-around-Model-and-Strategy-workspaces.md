---
id: TASK-107
title: Redesign Identity page IA around Model and Strategy workspaces
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
  - ./src/routes/identity/ExtractionAgentCard.tsx
  - ./src/routes/identity/IdentityModelBuilderCard.tsx
  - >-
    ./src/routes/identity/IdentityStrategyWorkbench.tsx
  - ./src/routes/identity/identity.css
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Rework the /identity experience so it reads as Model first and Strategy second. Replace the current operator-console layout with a two-workspace shell, hide Strategy until a current identity exists, use a sticky stateful header CTA for next-step guidance, and reframe the existing cards with product-facing copy instead of system-facing labels.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Identity exposes exactly two top-level workspaces: Model and Strategy.
- [x] #2 Strategy stays hidden until a current identity exists.
- [x] #3 Model renders as a non-gated scrolling workspace rather than a stepper or wizard.
- [x] #4 The page header exposes a sticky stateful primary CTA that reflects the next recommended action.
- [x] #5 Identity page copy is product-facing rather than system-facing.
- [x] #6 Relevant existing tests are updated to match intended copy and structure changes without masking unintended behavior changes.
- [x] #7 npm run build passes after the redesign lands.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Approved breakdown: complete TASK-107 sequentially as TASK-107.1 shell, TASK-107.2 card reframing, then TASK-107.3 inspection-panel demotion and polish.
For TASK-107.1, restrict code changes to IdentityPage and identity.css. Add Model and Strategy workspace tabs, hide Strategy until currentIdentity exists, add a sticky header, and introduce a stateful primary CTA plus secondary import-export actions.
Keep ExtractionAgentCard, IdentityModelBuilderCard, IdentityStrategyWorkbench, BulletConfidenceCard, and DraftSummaryCard behaviorally unchanged in this slice. Recompose them under the new shell only.
Update existing relevant tests for the new shell/header structure rather than adding broad new coverage in this slice.
Verification for TASK-107.1: targeted identity-page tests, npm run typecheck, npm run build, then independent review before commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented sequentially through TASK-107.1, TASK-107.2, and TASK-107.3 with atomic commits 31a0f51, 6175f06, 998eabd, and ad75234.

Task sequence: workspace shell first, card reframing second, inspection-panel demotion and accessibility polish third, with existing IdentityPage tests updated alongside the work rather than deferred.

Independent reviews across the sequence were recorded under .agents/reviews/review-20260412-002423.md through .agents/reviews/review-20260412-013843.md; the final pre-cleanup review had only maintainability guidance, and the last cleanup pass was locally re-verified.

Targeted verification across the redesign slices: npx vitest run src/test/IdentityPage.test.tsx; npm run typecheck; npx eslint --no-warn-ignored src/routes/identity/ExtractionAgentCard.tsx src/routes/identity/IdentityModelBuilderCard.tsx src/routes/identity/BulletConfidenceCard.tsx src/routes/identity/DraftSummaryCard.tsx src/routes/identity/IdentityPage.tsx src/routes/identity/IdentityStrategyWorkbench.tsx src/routes/identity/identity.css src/test/IdentityPage.test.tsx; npm run build.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Redesigned /identity around a Model-first / Strategy-second workspace shell. The page now exposes exactly two top-level workspaces, hides Strategy until a current identity exists, uses a sticky stateful header CTA for next-step guidance, reframes the extraction and builder surfaces with product-facing language, and demotes confidence/changelog inspection into secondary review panels beneath the main model flow.

Implementation landed in four atomic commits on main: 31a0f51 feat(identity): add workspace shell, 6175f06 refactor(identity): reframe workspace copy, 998eabd refactor(identity): demote secondary review panels, and ad75234 fix(identity): polish inspection panel accessibility.

Verification: npx vitest run src/test/IdentityPage.test.tsx; npm run typecheck; npx eslint --no-warn-ignored src/routes/identity/ExtractionAgentCard.tsx src/routes/identity/IdentityModelBuilderCard.tsx src/routes/identity/BulletConfidenceCard.tsx src/routes/identity/DraftSummaryCard.tsx src/routes/identity/IdentityPage.tsx src/routes/identity/IdentityStrategyWorkbench.tsx src/routes/identity/identity.css src/test/IdentityPage.test.tsx; npm run build.
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
