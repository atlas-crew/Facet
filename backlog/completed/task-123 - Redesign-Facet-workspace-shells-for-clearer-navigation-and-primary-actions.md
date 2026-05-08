---
id: TASK-123
title: Redesign Facet workspace shells for clearer navigation and primary actions
status: Done
assignee: []
created_date: '2026-04-14 12:41'
updated_date: '2026-04-14 14:40'
labels:
  - ux
  - navigation
  - workspace-shell
dependencies: []
references:
  - src/components/AppShell.tsx
  - src/routes/identity/IdentityPage.tsx
  - src/routes/research/ResearchPage.tsx
  - src/routes/pipeline/PipelinePage.tsx
  - src/routes/build/BuildPage.tsx
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Refactor the shared workspace experience so Facet reads as one coherent system instead of a flat collection of tools. This initiative should group navigation around the product journey, standardize major workspace headers, and make each workspace expose one dominant next action with secondary utilities clearly demoted.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The main app navigation is reorganized into grouped sections that reflect the Facet journey instead of presenting every workspace as an equal flat peer.
- [x] #2 Build, Research, and Pipeline each use a consistent workspace shell with a title, one-sentence purpose, status line, one dominant primary action, and clearly subordinate secondary actions.
- [x] #3 Each redesigned workspace has a clearer recommended path in both populated and empty states, without relying on users to infer the next step from scattered controls.
- [x] #4 Advanced or utility actions are visually demoted so they no longer compete with the primary workflow in the redesigned workspaces.
- [x] #5 Relevant tests and supporting copy are updated to match the new navigation and workspace-shell behavior, and the implementation verifies with typecheck, targeted tests, and build.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed the workspace-shell UX sweep across AppShell, Research, Pipeline, Build, and the supporting shell tests.
Navigation now groups workspaces by journey, Research is framed around search readiness and one dominant Run Search path, Pipeline emphasizes Add Entry and grouped detail actions, and Build surfaces one primary Download PDF action with clearer working context.
Closed all planned subtasks under TASK-123: TASK-123.1 through TASK-123.5.
Task commits: 1c848ee feat(app-shell): group workspace navigation; feat(research): emphasize search readiness; feat(pipeline): clarify workspace actions; feat(build): clarify workspace shell; test(app-shell): expand shell state coverage.
Verification across the slices used targeted vitest, npm run typecheck, targeted eslint, and npm run build after each commit.
Follow-up: TASK-124 captures the remaining deeper AppShell resilience coverage from the final audit so TASK-123 can close on the agreed shell/UX scope.
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
