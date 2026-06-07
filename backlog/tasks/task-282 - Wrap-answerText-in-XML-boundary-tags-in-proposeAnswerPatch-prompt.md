---
id: TASK-282
title: Wrap answerText in XML boundary tags in proposeAnswerPatch prompt
status: To Do
assignee: []
created_date: '2026-06-07 01:39'
labels:
  - quality
  - security
milestone: m-34
dependencies: []
references:
  - src/utils/identityParametersGeneration.ts
  - .agents/reviews/review-20260606-213653.md
priority: medium
ordinal: 38000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Source:** Code Review (TASK-278, iteration 1) — P2-002
**Severity:** P2
**Module:** `src/utils/identityParametersGeneration.ts` (line ~723, `proposeAnswerPatch` user prompt)

`answerText` is user-controlled free text interpolated directly into the LLM prompt without boundary markers. A candidate whose answer mimics system instructions or JSON formatting can confuse the model's instruction/data boundary — a prompt injection vector.

### Suggested approach
Wrap the interpolation in XML tags to strictly delimit user content:
```ts
<candidate_answer>${answerText}</candidate_answer>
```
This matches the pattern used by other Anthropic prompt-engineering best practices for separating user data from instructions.

### Acceptance criteria
- `answerText` is enclosed in `<candidate_answer>` XML tags in the user prompt
- No other prompt structure changes
- Existing `proposeAnswerPatch` tests pass
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
