---
id: TASK-266.3
title: Improve authenticated empty-workspace hub onboarding
status: To Do
assignee: []
created_date: '2026-05-29 00:21'
labels:
  - feature
  - homepage
  - onboarding
dependencies:
  - TASK-266.1
references:
  - src/routes/home/HomePage.tsx
  - src/test/HomePage.test.tsx
  - backlog/completed/task-191
documentation:
  - doc-44
parent_task_id: TASK-266
priority: medium
ordinal: 12000
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Authenticated users with no meaningful workspace data see a first-run hub state with clear actions such as import resume, add a job, or open the builder.
- [ ] #2 The first-run hub remains action-oriented and does not reintroduce public marketing or product-explainer copy into the authenticated Home/Overview surface.
- [ ] #3 Existing users with active workspace data still see the current prioritized hub modules and alerts.
- [ ] #4 Focused tests cover empty-workspace detection and at least one populated-workspace regression path.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect HomePage data dependencies and current empty/populated workspace behavior.\n2. Define the empty-workspace condition from existing stores without adding durable state unless necessary.\n3. Add focused first-run action modules inside the authenticated hub.\n4. Add regression tests for empty and populated workspace rendering.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Regression tests pass (scoped to touched files)
- [ ] #5 Linters report no warnings or errors in touched files
- [ ] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
