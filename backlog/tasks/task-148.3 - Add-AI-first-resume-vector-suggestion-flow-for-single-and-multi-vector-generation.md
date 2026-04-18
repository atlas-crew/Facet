---
id: TASK-148.3
title: >-
  Add AI-first resume vector suggestion flow for single and multi-vector
  generation
status: To Do
assignee: []
created_date: '2026-04-18 11:00'
updated_date: '2026-04-18 11:00'
labels:
  - resume
  - build
  - ai
  - identity
milestone: m-19
dependencies:
  - TASK-148.1
  - TASK-148.2
references:
  - src/utils/jdAnalyzer.ts
  - src/routes/build/BuildPage.tsx
  - src/store/resumeStore.ts
  - src/identity/schema.ts
parent_task_id: TASK-148
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Introduce an AI step that suggests resume vectors before downstream assembly guidance is applied. This should support both a single recommended vector flow and a multi-vector flow where vectors can be AI-suggested automatically or selected manually by the user.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 AI-enabled resume generation can return suggested resume vectors before bullet or component-level assembly guidance is applied.
- [ ] #2 Build exposes a single-vector flow that can accept one suggested vector and continue into assembly.
- [ ] #3 Build exposes a multi-vector flow that supports AI-suggested vectors and manual vector selection.
- [ ] #4 The vector suggestion step is clearly separated from downstream JD or assembly guidance in state and UI flow.
- [ ] #5 Targeted tests cover vector suggestion parsing, state transitions, and manual-vs-auto mode behavior.
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
