---
id: TASK-139
title: Add technical drills with answer template
status: To Do
assignee: []
created_date: '2026-04-16 13:12'
labels:
  - prep
  - generation
  - content
milestone: m-18
dependencies: []
references:
  - docs/development/plans/live-cheatsheet-content-v2.md#B4
  - src/types/prep.ts
  - src/utils/prepGenerator.ts
  - src/routes/prep/PrepLiveMode.tsx
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add structured "How would you..." scenario drills with a reusable answer framework. The Unanet reference has 9 drills following a consistent template pattern.

**Type changes:**
Add to PrepDeck:
- `answerTemplate?: string` — the reusable drill framework (e.g., "1. One sentence on problem shape → 2. Commit to a position → 3. Three to five concrete steps → 4. One gotcha → 5. One war story closer")

Drills are cards with category `'situational'` that follow the template. No new card type needed.

**Generation prompt update:**
- Generate an `answerTemplate` at the deck level — a reusable 5-step framework
- Generate 3-5 situational drill cards that follow the template
- Each drill has: title (the scenario prompt), script (full scripted answer following the template), keyPoints (the concrete steps)
- Drill count should vary by round type: 5-8 for technical/system-design rounds, 2-3 for behavioral/HM rounds

**Rendering:**
- The answer template renders at the top of the Situational section as a blue guidance block
- Individual drills render as normal cards with the three-layer disclosure (glance points → script → detail)

**Edit mode:**
- Answer template textarea in the deck-level "Active Prep Set" panel
- Individual drills edited as normal cards

**Store sanitization:**
- Validate answerTemplate as optional string, trim
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 answerTemplate field added to PrepDeck
- [ ] #2 Generation prompt produces answer template and 3-5 situational drills
- [ ] #3 Drill count varies by round type
- [ ] #4 Answer template renders as guidance block at top of Situational section
- [ ] #5 Drills render with three-layer disclosure pattern
- [ ] #6 Edit mode has answer template textarea in deck panel
- [ ] #7 Store sanitization validates answerTemplate
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
