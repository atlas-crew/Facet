---
id: TASK-255
title: Add Scenario card kind with decision tree and phased framework
status: Done
assignee:
  - '@myself'
created_date: '2026-05-11 04:52'
updated_date: '2026-05-11 08:04'
labels:
  - prep
  - types
  - generator
  - renderer
milestone: m-32
dependencies:
  - TASK-254
references:
  - src/types/prep.ts
  - src/utils/prepGenerator.ts
  - src/routes/prep/PrepCardView.tsx
documentation:
  - 'backlog doc-28: Change 3 (scenario shape)'
priority: medium
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add `PrepScenarioCard` to the discriminated union introduced by TASK-254. Scenario cards represent the "Why this scenario is likely → option table → recommendation → trap" decision-support shape used for system-design and tradeoff-rich rounds. Per doc-28 Change 3 (scenario shape).

The interface carries `whyLikely: string` (required — grounds the scenario in the interviewer's background or the company's current state), `decisionTree?: PrepDecisionTreeNode[]` (option | when-right | tradeoff table + recommendation + trap), and `phasedFramework?: PrepPhasedFrameworkPhase[]` (phase | timeframe | bullets — same decision shape rotated to a time-series rollout).

The renderer matches the reference artifact cited in doc-28: an option table with three columns (Option | When Right | Tradeoff) plus a "What I'd pick" callout plus a "Trap" warning. The Datadog-style phased-rollout variant uses `phasedFramework` instead of `decisionTree`. The generator (`prepGenerator.ts`) gets a scenario sub-prompt that emits option tables for system-design rounds rather than generic prose.

Depends on TASK-254 — without the union foundation there is no `kind` dispatcher to hook the scenario renderer into.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 PrepScenarioCard interface in src/types/prep.ts extends PrepCardBase with kind: 'scenario' and required whyLikely: string
- [x] #2 PrepDecisionTreeNode type defined: { title; options?: Array<{ option; whenRight; tradeoff }>; recommendation?; trap? }
- [x] #3 PrepPhasedFrameworkPhase type defined: { phase; timeframe?; bullets: string[] }
- [x] #4 PrepCardView scenario branch renders the option table (3 columns) + recommendation callout + trap warning
- [x] #5 PrepCardView scenario branch renders phased framework when present (alternative shape; either decisionTree or phasedFramework expected, not both required)
- [x] #6 isScenarioCard type guard exported from src/types/prep.ts
- [x] #7 prepGenerator.ts includes a scenario sub-prompt; emits option tables for system-design / tradeoff rounds when the round-type warrants
- [x] #8 Contract validator asserts whyLikely is non-empty on every scenario card
- [x] #9 Regression tests cover renderer (option table + phased framework variants) and generator emission of scenario cards
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Fill the existing scenario discriminated-union shape with decision-tree and phased-framework domain types plus strict guards/normalization.\n2. Add a read-only PrepCardView scenario renderer for option-table, recommendation, trap, and phased-framework variants without changing unrelated card kinds.\n3. Extend prepGenerator normalization/prompt/contract validation so scenario cards carry whyLikely and decision/phased structures for technical or system-design rounds.\n4. Add focused tests for types, renderer variants, generator emission/normalization, and contract validation; run format, focused tests, lint/typecheck, independent review/audit, close TASK-255, and commit with cortex only.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started TASK-255 locally while Worker Bookends owns TASK-258 in parallel. Scope is scenario card type/renderer/generator/validation only; avoid TASK-256 anchor, TASK-258 bookend, TASK-259 sections, and unrelated research/identity dirty files.

Implemented scenario card shape, generator normalization/prompt/contract handling, read-only rendering, import/store sanitation, and focused regression coverage. Verification: npx vitest run src/test/prepCardKind.test.ts src/test/PrepCardView.test.tsx src/test/PrepLiveMode.test.tsx src/test/prepGenerator.test.ts src/test/prepContractValidation.test.ts src/test/prepImport.test.ts src/test/prepStore.test.ts (223 tests passed); npm run typecheck -- --pretty false filtered to touched prep files (no output); npx eslint touched prep source/tests (clean). Review/audit artifacts: .agents/reviews/review-20260511-035206.md, .agents/reviews/test-audit-20260511-035410.md, .agents/reviews/test-audit-20260511-035709.md, .agents/reviews/test-audit-20260511-040058.md. Generator/store/import/render P1 audit gaps were remediated where actionable; remaining review notes are non-blocking design tradeoffs or defensive internal seams.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added scenario prep cards with whyLikely grounding, decision-tree option tables, phased-framework rollout support, renderer/import/store handling, generator prompt/normalization/contract checks, and regression coverage.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 Automatic formatting was applied to touched files
- [x] #4 Regression tests pass (scoped to touched files)
- [x] #5 Linters report no warnings or errors in touched files
- [x] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
