---
id: TASK-126
title: Redesign interview prep around homework and live cheatsheet modes
status: Done
assignee: []
created_date: '2026-04-14 16:48'
labels:
  - ux
  - prep
  - ai
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Split the Prep workspace into a study-oriented homework experience and a live interview cheatsheet experience while keeping a shared prep deck as the source of truth. Homework should support flash-card style quizzing and confidence-driven repetition. Live cheatsheet should support timer, keyboard shortcuts, fast navigation, search, and compact sectioned reference content for use during an interview.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Prep exposes distinct Edit, Homework, and Live Cheatsheet modes off the same underlying deck.
- [ ] #2 Homework supports flash-card style rehearsal with reveal flow and confidence-driven repetition or filtering.
- [ ] #3 Live Cheatsheet provides timer, keyboard shortcuts, fast section navigation, and compact interview-safe reference content.
- [ ] #4 Prep data model remains unified so generated/manual content can feed both homework and live cheatsheet projections.
- [ ] #5 Targeted tests cover the new mode shell and key homework/live interactions.
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
