---
id: TASK-2.1
title: Surface result-level citation stripping violations
status: To Do
assignee: []
created_date: '2026-05-06 23:06'
labels:
  - remediation
dependencies: []
parent_task_id: TASK-2
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Independent review of TASK-184 noted that normalizeResults() strips unresolved citation markers from matchReason/vectorAlignment/candidateEdge, but result-level fields that become empty do not currently flow into a contract-violations channel. The current TASK-184 slice drops unresolved markers per acceptance criteria; this follow-up should add observability without broadening the shipped citation rendering contract.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 normalizeResults or its caller exposes result-level citation stripping violations for QA/telemetry.
- [ ] #2 Search run contract violations include result field names when required prose becomes empty after unresolved citation markers are stripped.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Linters report no WARNINGS or ERRORS for touched files
- [ ] #5 Regression tests pass for touched files
<!-- DOD:END -->
