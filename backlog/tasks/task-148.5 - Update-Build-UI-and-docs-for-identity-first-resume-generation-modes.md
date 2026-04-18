---
id: TASK-148.5
title: Update Build UI and docs for identity-first resume generation modes
status: Done
assignee: []
created_date: '2026-04-18 11:00'
updated_date: '2026-04-18 17:14'
labels:
  - resume
  - build
  - docs
  - ux
milestone: m-19
dependencies:
  - TASK-148.2
  - TASK-148.3
  - TASK-148.4
references:
  - src/routes/build/BuildPage.tsx
  - src/components/AppShell.tsx
  - docs/reference/ai-feature-audit.md
parent_task_id: TASK-148
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Adapt the Build workspace UX and supporting documentation to the new generation model. Users should be able to understand and switch among single, multi-vector, and dynamic per-job modes, and the docs should explain how identity, vector suggestion, and pipeline context interact.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Build UI clearly exposes and explains single, multi-vector, and dynamic per-job generation modes.
- [x] #2 Users can see whether the current workspace came from identity-only generation, AI-suggested multi-vector generation, or a pipeline-driven dynamic job flow.
- [x] #3 Legacy copy that implies Build is primarily a hand-edited vector workspace is updated where needed.
- [x] #4 Relevant docs or in-product guidance describe the identity-first resume generation model and the role of AI vector suggestion.
- [x] #5 Targeted UI tests cover the new mode affordances and status surfaces.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a Build generation-model strip and refreshed Build/AppShell copy so the workspace clearly explains single, multi-vector, and dynamic per-job resume flows.
Added a new user guide at docs/user-guides/build.md covering identity-first resume generation, AI vector suggestion, and pipeline-driven dynamic variants.
Expanded BuildPage UI coverage for the new mode/status surfaces.
Verification:
- npx vitest run src/test/BuildPage.test.tsx
- npx eslint src/routes/build/BuildPage.tsx src/components/AppShell.tsx src/test/BuildPage.test.tsx
- npm run typecheck
- npm run build
Review artifacts:
- .agents/reviews/review-20260418-131039.md
- .agents/reviews/test-audit-20260418-131040.md
Notes: the AppShell audit surfaced broad pre-existing coverage debt outside this slice and was treated as non-gating for TASK-148.5.
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
