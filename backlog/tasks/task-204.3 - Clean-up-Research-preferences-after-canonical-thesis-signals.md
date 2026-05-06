---
id: TASK-204.3
title: Clean up Research preferences after canonical thesis signals
status: To Do
assignee: []
created_date: '2026-05-06 22:46'
labels:
  - refactor
  - search-redesign
  - lane-b
dependencies:
  - TASK-204.1
  - TASK-204.2
references:
  - src/routes/research/searchWorkspaceComponents.tsx
  - src/test/ResearchPage.test.tsx
documentation:
  - backlog doc-39
  - backlog TASK-204.1
  - backlog TASK-204.2
  - backlog TASK-204
parent_task_id: TASK-204
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update the Research workspace preference surface after TASK-204.1/TASK-204.2 remove duplicated search-stage filter arrays. SearchInstancePreferences should stop editing Prioritize/Avoid as free-text searchOverrides.filters inputs; canonical lookFor/avoid edits should route to the thesis strategy surface. Interview-stage preferences should remain visible only with copy/names that make their stage explicit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 SearchInstancePreferences no longer renders free-text Prioritize/Avoid inputs backed by searchOverrides.filters
- [ ] #2 Any edit affordance for search-stage lookFor/avoid routes to the thesis strategy/Thesis Map surface instead of mutating duplicate override fields
- [ ] #3 Strong fit/red flags labels or field names are clarified as interview-stage prep/process guidance
- [ ] #4 Focused UI/state tests cover the removed duplicate inputs and surviving interview-stage preference behavior
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Linters report no WARNINGS or ERRORS for touched files
- [ ] #5 Regression tests pass for touched files
<!-- DOD:END -->
