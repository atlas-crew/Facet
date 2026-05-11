---
id: TASK-258
title: Add openerCardId and closerCardId deck bookends with Live Mode integration
status: To Do
assignee: []
created_date: '2026-05-11 04:53'
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
- [ ] #1 openerCardId?: string and closerCardId?: string added to PrepDeck in src/types/prep.ts
- [ ] #2 prepGenerator.ts populates both fields when an opener (kind: 'opener') and a closer (kind: 'closer') are emitted
- [ ] #3 PrepLiveMode navigation starts at openerCardId when present, ignoring section ordering for the first card
- [ ] #4 PrepLiveMode navigation ends at closerCardId when present, ignoring section ordering for the last card
- [ ] #5 Absent openerCardId / closerCardId falls back to today's behavior (first-card / last-card by current sort)
- [ ] #6 Contract validator allows the optional fields and asserts they resolve to actual card IDs in deck.cards when set
- [ ] #7 Regression tests cover navigation routing with bookends present and absent
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Regression tests pass (scoped to touched files)
- [ ] #5 Linters report no warnings or errors in touched files
- [ ] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
