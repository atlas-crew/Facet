---
id: TASK-106
title: Redesign Identity page IA around Model and Strategy workspaces
status: To Do
assignee: []
created_date: '2026-04-12 03:25'
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
- [ ] #1 Identity exposes exactly two top-level workspaces: Model and Strategy.
- [ ] #2 Strategy stays hidden until a current identity exists.
- [ ] #3 Model renders as a non-gated scrolling workspace rather than a stepper or wizard.
- [ ] #4 The page header exposes a sticky stateful primary CTA that reflects the next recommended action.
- [ ] #5 Identity page copy is product-facing rather than system-facing.
- [ ] #6 Relevant existing tests are updated to match intended copy and structure changes without masking unintended behavior changes.
- [ ] #7 npm run build passes after the redesign lands.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
