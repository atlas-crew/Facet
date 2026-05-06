---
id: TASK-204.4
title: Reconcile TASK-196 filter toggles with canonical thesis signals
status: To Do
assignee: []
created_date: '2026-05-06 22:46'
labels:
  - documentation
  - search-redesign
  - lane-b
dependencies:
  - TASK-204.1
references:
  - >-
    backlog/tasks/task-196.3 -
    Add-stable-id-to-SearchProfileFilterEntry-per-search-disabledFilterIds-override.md
  - >-
    backlog/tasks/task-196.5 -
    Replace-filter-text-area-inputs-with-per-item-toggle-list-in-SearchInstancePreferences.md
documentation:
  - backlog doc-39
  - backlog TASK-196
  - backlog TASK-196.3
  - backlog TASK-196.5
  - backlog TASK-204
parent_task_id: TASK-204
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reconcile TASK-196.3 and TASK-196.5 after doc-39 and the TASK-204 implementation subtasks establish canonical thesis signal storage. The filter-toggle scope should no longer add stable ids or disabledFilterIds to searchOverrides.filters.* as long-lived storage. Either retarget per-search disabling to canonical thesis signal ids or explicitly close/de-scope the toggle portion if the product no longer needs it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 TASK-196.3 notes/description are updated to reflect doc-39 sequencing and avoid adding ids to deleted searchOverrides.filters fields
- [ ] #2 TASK-196.5 notes/description are updated to remove per-item toggle UI against legacy filter arrays or retarget it to canonical thesis signals
- [ ] #3 Any dependency changes are recorded so implementers know whether TASK-196.3 waits for TASK-204.1
- [ ] #4 Backlog records reference doc-39 and preserve the TASK-196 hard-constraints scope that remains unaffected
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Linters report no WARNINGS or ERRORS for touched files
- [ ] #5 Regression tests pass for touched files
<!-- DOD:END -->
