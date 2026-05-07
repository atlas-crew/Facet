---
id: TASK-196.3
title: Retarget per-search signal disablement to canonical SearchThesisSignal ids
status: To Do
assignee: []
created_date: '2026-04-29 08:41'
updated_date: '2026-05-07 20:02'
labels:
  - search-redesign
  - identity-model
dependencies:
  - TASK-204.1
references:
  - src/types/search.ts
  - src/store/searchStore.ts
  - src/utils/identitySearchProfile.ts
  - src/test/searchStore.test.ts
documentation:
  - backlog doc-39
  - backlog doc-34 (Search Parameters Surface — Design)
  - backlog doc-24 (Search Workspace Redesign)
parent_task_id: TASK-196
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reconciled by TASK-204.4 after doc-39 and TASK-204.1.

Do not add stable ids to SearchProfileFilterEntry and do not add disabledFilterIds to searchOverrides.filters.*. TASK-204.1 made SearchThesis.lookFor and SearchThesis.avoid the canonical search-stage signal lists, and those SearchThesisSignal entries already carry stable ids.

If per-search signal disablement remains desired, implement it against canonical SearchThesisSignal ids from SearchThesis.lookFor/SearchThesis.avoid, using storage that clearly references thesis signal ids rather than legacy profile filter strings. Legacy searchOverrides.filters.prioritize/avoid are deleted migration input and must not be revived.

TASK-196 hard-constraints work remains unaffected: industries, funding, remote, employment, salary, clearance, and company-size constraints still live under TASK-196.4 / the surviving hard-constraints scope.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 No code path adds ids to SearchProfileFilterEntry solely for deleted prioritize/avoid filter arrays
- [ ] #2 Any per-search disable storage references canonical SearchThesisSignal ids from SearchThesis.lookFor/SearchThesis.avoid, not searchOverrides.filters.*
- [ ] #3 Migration/default initialization is idempotent and tolerates existing thesis signal ids without regenerating them
- [ ] #4 Per-search disablement, if implemented, does not mutate canonical thesis signals; clearing the disable restores the signal for that search context
- [ ] #5 Tests cover canonical signal-id disablement or explicitly document that per-search signal toggles are de-scoped
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
