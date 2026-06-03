---
id: TASK-106
title: Redesign Identity page IA around Model and Strategy workspaces
status: Done
assignee: []
created_date: '2026-04-12 03:25'
updated_date: '2026-05-05'
labels:
  - feature
  - identity
  - ux
  - frontend
  - duplicate
dependencies: []
references:
  - ./src/routes/identity/IdentityPage.tsx
  - ./src/routes/identity/ExtractionAgentCard.tsx
  - ./src/routes/identity/IdentityModelBuilderCard.tsx
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

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed as duplicate of TASK-107. Both tasks share identical title, description, acceptance criteria, and references — TASK-106 is residue from TASK-107 planning. The end state described in the AC shipped via TASK-107's commits `31a0f51` (workspace shell), `6175f06` (copy reframe), `998eabd` (panel demotion), and `ad75234` (accessibility polish) on 2026-04-12.

Subsequent identity-workspace evolution beyond TASK-107's original scope (Map-only convergence, IdentityStrategyWorkbench retirement, sheet primitive) is tracked under TASK-195 and TASK-202 — not under this duplicate.

References list pruned to remove the path to `IdentityStrategyWorkbench.tsx`, retired in commit `6afda50`.
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

> All Acceptance Criteria and Definition of Done items above are inherited from TASK-107's verification record (commits `31a0f51` / `6175f06` / `998eabd` / `ad75234`). This task itself shipped no work; its checkmarks reflect the duplicate's resolution, not separate verification.
