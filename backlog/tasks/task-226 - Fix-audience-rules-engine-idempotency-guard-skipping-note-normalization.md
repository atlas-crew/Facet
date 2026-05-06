---
id: TASK-226
title: Fix audience rules-engine idempotency guard skipping note normalization
status: To Do
assignee: []
created_date: '2026-05-06 07:33'
labels:
  - audience-tagging
  - bug
dependencies: []
references:
  - src/utils/audienceRules.ts
  - src/store/jdAnalysisStore.ts
  - src/test/jdAnalysis.test.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why (foundation bug found during fixture migration)

`applyRulesBasedAudiences` short-circuits when `input.audienceRulesVersion === AUDIENCE_RULES_VERSION` and returns the input as-is. But `sanitizeAnalysis` (in `src/store/jdAnalysisStore.ts`) calls `trimWarningNotes` *before* calling `applyRulesBasedAudiences` — and `trimWarningNotes` can produce a `string[]` when the persisted record had legacy string warnings.

Result: a JDAnalysis with `audienceRulesVersion === 'audience-rules.v1'` can have `warnings: string[]` after sanitize, contradicting the type (`warnings: TaggedNote[]`).

This was discovered during fixture migration in `src/test/jdAnalysis.test.ts` — the "migrates arbitrary persisted JDAnalysis state safely" test had to set `audienceRulesVersion: 'audience-rules.legacy'` to force the rules engine to actually run on string warnings.

## Reproducer

```ts
const analysis: JDAnalysis = {
  ...validAnalysis,
  audienceRulesVersion: 'audience-rules.v1',
  warnings: ['legacy string'] as unknown as TaggedNote[],
}
const out = applyRulesBasedAudiences(analysis)
// out.warnings is still ['legacy string'] (string[]) — type lie
```

## Fix options

1. Make the idempotency guard also check that `warnings`, `strengthsToLead`, `gapFocus`, `positioningRecommendations` are `TaggedNote[]` before short-circuiting. Run the rules engine if any are `string[]`.
2. Move `trimWarningNotes` *after* `applyRulesBasedAudiences` in `sanitizeAnalysis`. Then trim TaggedNote.text on the output instead of the input.
3. Drop the idempotency guard entirely (always run the rules engine). Cost: O(n) work per hydration even when no change.

Option 1 is least disruptive. Option 2 is structurally cleaner but requires verifying trim behavior on TaggedNote arrays.

## Acceptance criteria

- Idempotency guard does not return string-array TaggedNote fields untouched
- Test covers the case (legacy string warnings + matching rulesVersion → properly tagged output)
- Existing tests still pass without re-asserting type lies
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
