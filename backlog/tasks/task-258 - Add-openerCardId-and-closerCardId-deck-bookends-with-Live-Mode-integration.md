---
id: TASK-258
title: Add openerCardId and closerCardId deck bookends with Live Mode integration
status: Done
assignee:
  - '@myself'
created_date: '2026-05-11 04:53'
updated_date: '2026-05-11 08:04'
labels:
  - prep
  - types
  - live-mode
milestone: m-32
dependencies:
  - TASK-254
references:
  - src/types/prep.ts
  - src/utils/prepGenerator.ts
  - src/routes/prep/PrepLiveMode.tsx
documentation:
  - 'backlog doc-28: Change 5 (bookends half)'
priority: low
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add `openerCardId?: string` and `closerCardId?: string` fields to `PrepDeck` so Live Mode always starts navigation at the opener card and ends at the closer card. Per doc-28 Change 5 (bookends half — the scriptKind half is a separate task).

Today users must remember to drag the opener into position; this task makes the deck declare its bookends. Live Mode's keyboard navigation (j/k, number keys) routes around the bookends — the opener is the first card visited, the closer is the last, regardless of section ordering. The generator sets `openerCardId` to a card with `kind: 'opener'` and `closerCardId` to a card with `kind: 'closer'` when those kinds are emitted.

Absence of these fields falls back to today's first-card / last-card behavior, so legacy decks render cleanly.

Depends on TASK-254 — bookends point to cards with specific kinds ('opener', 'closer'), which only exist after the union foundation lands.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 openerCardId?: string and closerCardId?: string added to PrepDeck in src/types/prep.ts
- [x] #2 prepGenerator.ts populates both fields when an opener (kind: 'opener') and a closer (kind: 'closer') are emitted
- [x] #3 PrepLiveMode navigation starts at openerCardId when present, ignoring section ordering for the first card
- [x] #4 PrepLiveMode navigation ends at closerCardId when present, ignoring section ordering for the last card
- [x] #5 Absent openerCardId / closerCardId falls back to today's behavior (first-card / last-card by current sort)
- [x] #6 Contract validator allows the optional fields and asserts they resolve to actual card IDs in deck.cards when set
- [x] #7 Regression tests cover navigation routing with bookends present and absent
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add optional openerCardId/closerCardId fields to PrepDeck without changing persistence migrations because they are additive optional deck metadata.
2. Populate bookend ids in prepGenerator from generated opener/closer cards and validate any explicit ids resolve to deck.cards.
3. Route PrepLiveMode section ordering/navigation through deck bookends while preserving legacy ordering when ids are absent or invalid.
4. Add focused generator/contract and Live Mode regression tests, then run scoped Vitest, ESLint, typecheck, independent review/audit, backlog closure, and a cortex git commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Integrated the paused worker's bookend slice into the shared prep changes after resolving overlap with TASK-255. Added optional deck bookend fields, generator resolution from opener/closer card kinds, store/import sanitation for stale and duplicate ids, and Live Mode ordering/navigation guards for present, duplicate, and unknown ids. Verification: npx vitest run src/test/prepCardKind.test.ts src/test/PrepCardView.test.tsx src/test/PrepLiveMode.test.tsx src/test/prepGenerator.test.ts src/test/prepContractValidation.test.ts src/test/prepImport.test.ts src/test/prepStore.test.ts (223 tests passed); npm run typecheck -- --pretty false filtered to touched prep files (no output); npx eslint touched prep source/tests (clean). Review/audit artifacts: .agents/reviews/review-20260511-035206.md, .agents/reviews/test-audit-20260511-035410.md, .agents/reviews/test-audit-20260511-035709.md, .agents/reviews/test-audit-20260511-040058.md.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added PrepDeck opener/closer bookends, generator population, contract/store/import validation, and Live Mode keyboard/section ordering behavior with regression coverage.
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
