---
id: TASK-114.1
title: Calibrate skill enrichment prompts and add stale tracking
status: Done
assignee: []
created_date: '2026-04-12 14:52'
updated_date: '2026-04-12 20:16'
labels:
  - identity
  - skill-enrichment
  - frontend
  - ai
dependencies: []
parent_task_id: TASK-114
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Behavior/UI slice: no avoid inference, no depth prefill without bullet evidence, shape-of-engagement context prompt, positioning prompt/examples, optional-field treatment, and stale-on-depth-change handling.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Depth is only pre-filled when evidence supports expert/strong/working/basic
- [x] #2 Context and positioning examples appear inline in the wizard
- [x] #3 Context and positioning can be left empty without marking a skill incomplete
- [x] #4 Depth changes mark context and positioning stale with explicit re-draft affordances
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Calibrated the skill enrichment wizard so AI only infers non-avoid depth when bullet evidence exists, context and positioning are optional, and depth changes mark those optional fields stale. Added inline examples, stale refresh affordances, persisted field-level stale flags, and expanded regression coverage around redirects, AI failures, provenance, and partial responses.
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
