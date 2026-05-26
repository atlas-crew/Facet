---
id: TASK-259
title: Add PrepDeckSection for deck-scoped sidebar grouping
status: Done
assignee:
  - '@codex'
created_date: '2026-05-11 04:53'
updated_date: '2026-05-26 01:43'
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
  - src/routes/prep/PrepPage.tsx
  - src/routes/prep/PrepLiveMode.tsx
documentation:
  - 'backlog doc-28: Change 6 (deck-scoped section taxonomy)'
priority: low
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add `PrepDeckSection` type and `sections?: PrepDeckSection[]` field on `PrepDeck` so different round shapes can declare different sidebar groupings. Per doc-28 Change 6.

Today the sidebar groups cards by hardcoded categories (Intel / Openers / Core / Technical / Tactical). Different round shapes need different groupings — a Panel round wants one section per interviewer card, a Technical round wants "Anchor" and "Scenarios" as top-level sections. `PrepDeckSection { id; title; cardIds: string[] }` declares grouping deck-side; cards remain single-owner (a card belongs to one section, declared via cardIds ordering on the section).

The sidebar reads `deck.sections` first and falls back to today's category-based grouping when absent, so legacy decks continue rendering cleanly. The generator emits sections per round-type: Panel rounds emit one section per interviewer's intel card; Technical rounds emit "Anchor" + "Scenarios" + "Deep Dives" sections.

Depends on TASK-254 — sections reference cards, and the per-kind interfaces let the generator emit deliberate section layouts (Panel section contains intel cards; Anchor section contains the anchor card + its supporting story cards).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 PrepDeckSection interface declared in src/types/prep.ts: { id: string; title: string; cardIds: string[] }
- [x] #2 sections?: PrepDeckSection[] added to PrepDeck
- [x] #3 Sidebar renders deck.sections when present, ordered by section index then by cardIds order within each section
- [x] #4 Sidebar falls back to category-based grouping when sections is absent (existing behavior preserved)
- [x] #5 prepGenerator.ts emits sections per round-type: Panel rounds produce one section per interviewer card; Technical rounds produce Anchor + Scenarios + Deep Dives sections
- [x] #6 Contract validator allows the optional field and asserts cardIds resolve to actual card IDs in deck.cards
- [x] #7 Regression tests cover sidebar rendering with sections present and absent, plus generator section emission per round type
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-05-26 Codex starting TASK-259. Plan: add PrepDeckSection and optional PrepDeck.sections; normalize/import/export/persist the optional deck sections safely; update PrepLiveMode/PrepPage sidebar grouping to prefer deck.sections and preserve current category fallback; teach prepGenerator schema/prompt/normalization/contract validation to emit/validate panel and technical round sections; add focused tests for typed deck sections, sidebar section rendering/fallback, generator emission, and invalid cardIds; run scoped tests, typecheck/lint/format/full-enough regression gates, independent review/audit where available, commit via cortex git commit, then close with receipts.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
2026-05-26 Codex completed TASK-259. Implemented PrepDeckSection and optional PrepDeck.sections across types, store normalization/export, import validation, generator schema/prompt/normalization/contract validation, and live cheatsheet/sidebar derivation. Deck sections now render ahead of fallback card-category sections when valid, preserve legacy category grouping for absent/unclaimed cards, keep opener cards in dedicated opener sections, and defensively skip malformed imported section payloads. Generator supports valid model-provided sections, deterministic panel sections, technical Anchor/Scenarios/Deep Dives fallbacks, invalid-section fallback repair, duplicate card ownership repair, and contract violations for missing/duplicate section cardIds. Verification: focused prep suite passed (8 files/167 tests), generator/contract suite passed (49 tests), store/import suite passed (32 tests), npm run typecheck passed, npm run lint passed, git diff --check passed, full npm run test passed (174 files/2572 tests). Independent review: specialist-review PASS WITH ISSUES after P1 remediation; remaining notes were maintainability/design tradeoffs. Independent audit: helper audit remediated P1/P2 gaps; generator audit remediated P1 gaps; store/import audit remediated P1 boundary gap.
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
