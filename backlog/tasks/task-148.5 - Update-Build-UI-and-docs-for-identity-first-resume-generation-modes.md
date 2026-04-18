---
id: TASK-148.5
title: Update Build UI and docs for identity-first resume generation modes
status: To Do
assignee: []
created_date: '2026-04-18 11:00'
updated_date: '2026-04-18 11:00'
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
- [ ] #1 Build UI clearly exposes and explains single, multi-vector, and dynamic per-job generation modes.
- [ ] #2 Users can see whether the current workspace came from identity-only generation, AI-suggested multi-vector generation, or a pipeline-driven dynamic job flow.
- [ ] #3 Legacy copy that implies Build is primarily a hand-edited vector workspace is updated where needed.
- [ ] #4 Relevant docs or in-product guidance describe the identity-first resume generation model and the role of AI vector suggestion.
- [ ] #5 Targeted UI tests cover the new mode affordances and status surfaces.
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
