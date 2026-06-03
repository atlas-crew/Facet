---
id: TASK-226
title: Fix audience rules-engine idempotency guard skipping note normalization
status: Done
assignee: []
created_date: '2026-05-06 07:33'
updated_date: '2026-05-06 20:29'
labels:
  - audience-tagging
  - bug
milestone: m-28
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

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed via shape-aware idempotency guard in `applyRulesBasedAudiences`. Commit: `fix(audience): make idempotency guard verify TaggedNote shape, not just version stamp`.

**Approach taken:** Option 1 from the task (least-disruptive). The guard now verifies both the version stamp AND the runtime shape of the four TaggedNote arrays (warnings, strengthsToLead, gapFocus, positioningRecommendations) before short-circuiting. Either signal alone is insufficient — stamp+shape together is the actual proof that the rules engine has run on the record.

**Why not Option 2 (move trim after rules):** would have required reshaping `trimWarningNotes` to operate on `TaggedNote[]` and restructuring `sanitizeAnalysis`, with a wider blast radius for the same correctness outcome.

**Why not Option 3 (drop guard entirely):** preserves the optimization for the common case (~all real records pass shape check) at minimal cost (the shape check is O(n) on note arrays only, ~tens of items max per analysis).

**Test coverage:**
- New regression test in `src/test/audienceModule.test.ts` that constructs the exact bug scenario (current stamp + string[] notes) and asserts proper TaggedNote[] output after `applyRulesBasedAudiences`.
- Reverted the `audience-rules.legacy` override workaround in `src/test/jdAnalysis.test.ts`'s "migrates arbitrary persisted JDAnalysis state safely" test — no longer needed since the shape-aware guard catches the type lie automatically.

**Verification:** 19 audienceModule tests pass (was 18). 0 production typecheck errors.
<!-- SECTION:FINAL_SUMMARY:END -->
