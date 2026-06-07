---
id: TASK-281
title: Apply removeVoiceTells to array string elements in normalizeAnswerPatch
status: To Do
assignee: []
created_date: '2026-06-07 01:39'
labels:
  - quality
milestone: m-34
dependencies: []
references:
  - src/utils/identityParametersGeneration.ts
  - .agents/reviews/review-20260606-213653.md
priority: medium
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Source:** Code Review (TASK-278, iteration 1) — P2-001
**Severity:** P2
**Module:** `src/utils/identityParametersGeneration.ts`

`removeVoiceTells` is applied to scalar string fields (`problem`, `action`, `outcome`, `text`) in `normalizeAnswerPatch` but not to elements of array fields (`impact`, `items` in unfair-advantage). AI-generated phrases with em-dash voice tells can leak into bullet point impact strings or unfair-advantage items.

### Suggested approach
Map `removeVoiceTells` over each array before returning:
```ts
impact: normalizeStringArray(bulletRecord.impact).map(removeVoiceTells)
items: normalizeStringArray(record.items).map(removeVoiceTells)
```

### Acceptance criteria
- `removeVoiceTells` is applied to every string element in `impact` and `items` arrays
- Existing tests pass
- A test asserting em-dash removal in an `impact` array element is added
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
