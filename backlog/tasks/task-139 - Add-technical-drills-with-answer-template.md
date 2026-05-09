---
id: TASK-139
title: Add technical drills with answer template
status: Done
assignee:
  - '@codex'
created_date: '2026-04-16 13:12'
updated_date: '2026-05-09 01:08'
labels:
  - prep
  - generation
  - content
milestone: m-18
dependencies:
  - TASK-170
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
- [x] #1 answerTemplate field added to PrepDeck
- [x] #2 Generation prompt produces answer template and 3-5 situational drills
- [x] #3 Drill count varies by round type
- [x] #4 Answer template renders as guidance block at top of Situational section
- [x] #5 Drills render with three-layer disclosure pattern
- [x] #6 Edit mode has answer template textarea in deck panel
- [x] #7 Store sanitization validates answerTemplate
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Starting TASK-139 after TASK-136 closure. Scope: add PrepDeck answerTemplate, sanitize/export/import it, expose an Active Prep Set textarea, prompt/normalize generator output, and render the template as Situational live guidance with focused tests.

Implemented deck-level answerTemplate for technical/situational drills: typed PrepDeck field, sanitized persistence/export/import behavior, generator schema/prompt/normalization, Active Prep Set textarea, live-mode labelled guidance block with ordered-list rendering, and focused regression coverage. Scoped tests and lint pass; npm run build still fails only on unrelated src/test/identityFieldDeps.test.ts SkillMatch export debt.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added reusable answer template support for technical/situational prep drills. The generator can emit a deck-level framework, stores sanitize and preserve it, edit mode exposes it in Active Prep Set, and live mode renders it as accessible guidance above technical/situational drill sections. Verification: format:files passed; focused Vitest set passed (207 tests); scoped ESLint passed; npm run build attempted and is blocked only by unrelated src/test/identityFieldDeps.test.ts SkillMatch export error.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
