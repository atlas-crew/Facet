---
id: TASK-284
title: >-
  Add optional chaining for identity.roles and identity.skills.groups in
  normalizeAnswerPatch
status: To Do
assignee: []
created_date: '2026-06-07 01:39'
labels:
  - improvement
milestone: m-34
dependencies: []
references:
  - src/utils/identityParametersGeneration.ts
  - .agents/reviews/review-20260606-213653.md
priority: low
ordinal: 40000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Source:** Code Review (TASK-278, iteration 1) — P3-002
**Severity:** P3
**Module:** `src/utils/identityParametersGeneration.ts` (lines 611-613)

`identity.roles.some(...)` and `identity.skills.groups.some(...)` assume these arrays are always defined. A malformed or partial identity passed to `normalizeAnswerPatch` would throw a `TypeError` rather than the expected validation `Error`.

### Suggested approach
Use optional chaining:
```ts
identity.roles?.some((r) => r.id === roleId)
identity.skills?.groups?.some((g) => g.id === groupId)
```
The `??` operator or a falsy check then routes to the unknown-id error path instead of crashing.

### Acceptance criteria
- Optional chaining used on both access paths
- A test with a partial identity (roles undefined) produces an Error not a TypeError
- All existing tests pass
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Regression tests pass (scoped to touched files)
- [ ] #5 Linters report no warnings or errors in touched files
- [ ] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
