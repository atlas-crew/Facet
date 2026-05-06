---
id: TASK-204.2
title: Remove duplicate filter arrays from thesis generation contract
status: To Do
assignee: []
created_date: '2026-05-06 22:46'
labels:
  - refactor
  - search-redesign
  - lane-b
dependencies:
  - TASK-204.1
references:
  - src/utils/thesisGenerator.ts
  - src/test/thesisGenerator.test.ts
documentation:
  - backlog doc-39
  - backlog TASK-204.1
  - backlog TASK-204
parent_task_id: TASK-204
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update thesis generation per doc-39 after TASK-204.1 defines the canonical thesis signal shape. The LLM response schema should emit canonical search-stage lookFor/avoid only, not duplicate searchOverrides.filters.prioritize/searchOverrides.filters.avoid arrays. Normalization may accept legacy generated filter arrays as migration input, but new generation must not produce them as canonical output.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 thesisGenerator prompt schema no longer asks the LLM for searchOverrides.filters.prioritize or searchOverrides.filters.avoid
- [ ] #2 normalizeGeneratedSearchThesis maps any legacy generated filter arrays through the canonical signal migration path instead of preserving duplicate storage
- [ ] #3 Generated thesis tests assert canonical lookFor/avoid output and absence of searchOverrides.filters in new theses
- [ ] #4 Contract-violation or fixture tests are updated to reflect the single search-stage signal surface
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Linters report no WARNINGS or ERRORS for touched files
- [ ] #5 Regression tests pass for touched files
<!-- DOD:END -->
