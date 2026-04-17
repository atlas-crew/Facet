---
id: TASK-126.2
title: Add shared prep mode state and derived cheatsheet projections
status: Done
assignee: []
created_date: '2026-04-14 16:48'
labels:
  - prep
  - architecture
dependencies: []
parent_task_id: TASK-126
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend the prep types/store just enough to support homework session state, lightweight confidence tracking, and derived cheatsheet sections while preserving one underlying prep deck model.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Prep types/store support homework-oriented per-card study state without forking deck content.
- [ ] #2 Live cheatsheet can derive sectioned content from the shared deck data.
- [ ] #3 Existing prep decks remain compatible through migration or safe defaults.
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
