---
id: TASK-204.4
title: Reconcile TASK-196 filter toggles with canonical thesis signals
status: Done
assignee:
  - '@codex'
created_date: '2026-05-06 22:46'
updated_date: '2026-05-08 07:49'
labels:
  - documentation
  - search-redesign
  - lane-b
dependencies:
  - TASK-204.3
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
- [x] #1 TASK-196.3 notes/description are updated to reflect doc-39 sequencing and avoid adding ids to deleted searchOverrides.filters fields
- [x] #2 TASK-196.5 notes/description are updated to remove per-item toggle UI against legacy filter arrays or retarget it to canonical thesis signals
- [x] #3 Any dependency changes are recorded so implementers know whether TASK-196.3 waits for TASK-204.1
- [x] #4 Backlog records reference doc-39 and preserve the TASK-196 hard-constraints scope that remains unaffected
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Completed TASK-204.4 as backlog/documentation reconciliation only. Updated TASK-196 parent scope to reflect doc-39 canonical signal storage while preserving hard-constraints work. Retitled and rewrote TASK-196.3 so any per-search signal disablement targets canonical SearchThesis.lookFor/SearchThesis.avoid signal ids instead of adding ids/disabledFilterIds to deleted searchOverrides.filters.* arrays; dependency now waits on TASK-204.1. Retitled and rewrote TASK-196.5 so any toggle UI renders from canonical thesis signals or explicitly de-scopes toggles, and does not restore legacy Prioritize/Avoid text inputs. Documentation references now include doc-39.

Validation: backlog task 196.3 --plain; backlog task 196.5 --plain; backlog task 196 --plain; backlog task 204.4 --plain. No source code changed in this slice, so regression tests/lint/build are not applicable beyond markdown/backlog parsing.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 Automatic formatting was applied to touched files
- [x] #4 Linters report no WARNINGS or ERRORS for touched files
- [x] #5 Regression tests pass for touched files
<!-- DOD:END -->
