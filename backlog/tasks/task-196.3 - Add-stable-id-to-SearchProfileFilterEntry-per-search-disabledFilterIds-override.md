---
id: TASK-196.3
title: >-
  Add stable id to SearchProfileFilterEntry + per-search disabledFilterIds
  override
status: To Do
assignee: []
created_date: '2026-04-29 08:41'
labels:
  - search-redesign
  - identity-model
dependencies:
  - TASK-165
references:
  - src/types/search.ts
  - src/store/searchStore.ts
  - src/utils/identitySearchProfile.ts
  - src/test/searchStore.test.ts
documentation:
  - backlog doc-34 (Search Parameters Surface — Design)
  - backlog doc-24 (Search Workspace Redesign)
parent_task_id: TASK-196
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Per-search filter toggle UX (subtask .5) needs a stable identifier per filter entry so a search can record "this entry is disabled for this run" without coupling to label text (which the user can edit). TASK-165 (in progress) restructures SearchProfileFilterEntry but does not add ids; this task extends TASK-165's deliverable.

Adds `id: string` to `SearchProfileFilterEntry`. Adds `disabledFilterIds: string[]` to `SearchInstanceFilterOverrides` for per-search disable. Default empty array means "all master-list filters apply to this search."

**Hard prerequisite: TASK-165 must merge first.** This task assumes the post-TASK-165 shape (`{label, condition, severity}`) as its starting point.

Filter id semantics, override default behavior, and chained migration are specified in backlog doc-34 §4–6.

Migration must be idempotent: do not regenerate ids on already-id-bearing entries — that would break per-search override references silently.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 SearchProfileFilterEntry includes id: string field; ids are url-safe and stable across user edits to label, condition, or severity
- [ ] #2 SearchInstanceFilterOverrides includes disabledFilterIds: string[]; default initialization is an empty array
- [ ] #3 searchStore.migrateSearchState assigns ids to existing filter entries that lack them; migration is idempotent (no-op on entries that already have ids)
- [ ] #4 Master list mutation (add) generates a new id; (edit) preserves the existing id; (delete) does not orphan disabledFilterIds entries on disk but tolerates them as no-op references
- [ ] #5 Per-search disable does not mutate the master list; clearing disable (removing id from disabledFilterIds) restores the entry for that search
- [ ] #6 New tests cover: adding a filter assigns id, editing preserves id, per-search disable doesn't affect master list, ids survive store rehydration, migration is idempotent on a second run
- [ ] #7 Existing tests pass without modification
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
