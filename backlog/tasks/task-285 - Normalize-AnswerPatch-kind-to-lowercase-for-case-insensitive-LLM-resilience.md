---
id: TASK-285
title: Normalize AnswerPatch kind to lowercase for case-insensitive LLM resilience
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
ordinal: 41000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Source:** Code Review (TASK-278, iteration 1) — P3-003
**Severity:** P3
**Module:** `src/utils/identityParametersGeneration.ts` (line 607)

`record.kind` is extracted with `.trim()` only. LLMs occasionally capitalize discriminants (e.g. `"Role-Bullet"` instead of `"role-bullet"`), which would produce an "unknown kind" error despite the intent being clear.

### Suggested approach
Add `.toLowerCase()` after `.trim()`:
```ts
const kind = isString(record.kind) ? record.kind.trim().toLowerCase() : ''
```

### Acceptance criteria
- Kind is lowercased before routing
- A test with `"Role-Bullet"` input normalizes correctly to a `role-bullet` patch
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
