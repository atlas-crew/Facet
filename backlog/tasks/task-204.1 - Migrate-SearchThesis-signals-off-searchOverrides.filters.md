---
id: TASK-204.1
title: Migrate SearchThesis signals off searchOverrides.filters
status: To Do
assignee: []
created_date: '2026-05-06 22:46'
labels:
  - refactor
  - search-redesign
  - lane-b
dependencies: []
references:
  - src/types/search.ts
  - src/store/searchStore.ts
  - src/test/searchStore.test.ts
documentation:
  - backlog doc-39
  - backlog doc-34
  - backlog TASK-204
parent_task_id: TASK-204
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement doc-39's schema and persisted-state migration for canonical search-stage signals. Enrich SearchThesis.lookFor / SearchThesis.avoid into stable signal entries, lift legacy searchOverrides.filters.prioritize into lookFor, lift legacy searchOverrides.filters.avoid into avoid, and remove searchOverrides.filters as canonical thesis storage. Keep searchOverrides.constraints, searchOverrides.interviewPrefs, and hiddenSkillIds intact. This should land before TASK-196.3 so TASK-196 does not add ids/toggles to fields that disappear.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 SearchThesis lookFor and avoid use one canonical enriched signal shape with stable ids and qualifier support
- [ ] #2 Persisted theses with legacy lookFor string arrays, avoid objects, and searchOverrides.filters arrays migrate non-destructively and idempotently
- [ ] #3 Duplicate entries across canonical and legacy surfaces are deduped case-insensitively without losing avoid.condition
- [ ] #4 searchOverrides.filters is no longer produced or required after migration while constraints/interviewPrefs/hiddenSkillIds remain intact
- [ ] #5 Regression tests cover union/dedupe, condition preservation, idempotency, and already-migrated no-op behavior
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Linters report no WARNINGS or ERRORS for touched files
- [ ] #5 Regression tests pass for touched files
<!-- DOD:END -->
