---
id: TASK-51
title: 'Pipeline: richer search across fields and saved filter sets'
status: In Progress
assignee:
  - '@codex'
created_date: '2026-03-10 03:54'
updated_date: '2026-05-27 20:54'
labels:
  - feature
  - pipeline
milestone: m-4
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Current pipeline search only matches company/role. Expand search to other fields and add saved filter presets (e.g., 'T1 active', 'Waiting on response').
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Search matches across company, role, notes, nextStep, skillMatch, and jobDescription.
- [ ] #2 Users can save, name, and re-apply filter sets; persistence is local.
- [ ] #3 No regression in sorting/filter performance with moderate datasets.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-05-27 Codex starting TASK-51 as part of m-4 completion push. Plan: inspect Pipeline filters/search state and persistence boundaries, expand search fields, add local saved filter sets with UI and tests, keep performance behavior straightforward for moderate datasets, run review/audit gates, and commit atomically.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Documentation has been created/modified/removed as needed.
- [ ] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [ ] #4 Test changes were approved by a test gap analysis review
- [ ] #5 Changes to integration points are covered by tests
- [ ] #6 All tests pass successfully
- [ ] #7 Automatic formatting was applied.
- [ ] #8 Linters report no WARNINGS or ERRORS
- [ ] #9 The project builds successfully
<!-- DOD:END -->
