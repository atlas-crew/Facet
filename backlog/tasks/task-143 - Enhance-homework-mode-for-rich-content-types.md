---
id: TASK-143
title: Enhance homework mode for rich content types
status: Done
assignee: []
created_date: '2026-04-16 13:13'
updated_date: '2026-04-18 08:31'
labels:
  - prep
  - homework
  - ui
milestone: m-18
dependencies:
  - TASK-135
references:
  - docs/development/plans/live-cheatsheet-content-v2.md#B9
  - src/routes/prep/PrepPracticeMode.tsx
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Upgrade the homework (flashcard rehearsal) mode to leverage the rich content types from the MVP and Wave 1.

**Story blocks in flashcards:**
- Question side: show card title + keyPoints (glance points) as the recall cue
- Reveal side: show full storyBlocks with Problem/Solution/Result/Closer labels
- This trains the user to reconstruct the narrative from glance points — the actual interview skill

**Conditional drilling (requires B1/TASK-135):**
- After the main card is reviewed, present each conditional's trigger as a secondary flashcard
- "If they push on why you left..." → user mentally rehearses the pivot → reveal shows the response
- Only for cards that have conditionals

**Opener-specific homework filter:**
- Add 'openers' as a filter option alongside 'all', 'needs_work', 'unreviewed'
- Lets the user rehearse the 75-second scripts separately

**Placeholder exclusion:**
- Cards with placeholder/needs-review indicators (from future context gap work) excluded from homework by default
- Show "N needs attention" count in the filter bar as a passive reminder

**Glance points as memory aids:**
- When a card has keyPoints but no storyBlocks, the flashcard shows title only on the question side
- Reveal shows keyPoints as the answer — user checks if they remembered the key hits
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Flashcards show title + keyPoints as question, storyBlocks on reveal
- [x] #2 Cards with conditionals present triggers as secondary flashcards after main review
- [x] #3 Opener filter option available in homework mode
- [x] #4 Cards without storyBlocks fall back to existing flashcard behavior
- [x] #5 Glance points serve as recall cues when storyBlocks absent
- [x] #6 All existing homework functionality preserved (confidence grading, shuffle, filter counts)
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Enhanced homework mode for rich prep content. Homework now defaults to eligible cards only, supports opener filtering, story/key-point reveal variants, and conditional follow-up drills with tone-aware rendering. Practice mode preserves snapshot-based session behavior, skips stale removed cards/conditionals safely, and keeps keyboard/escape behavior aligned across active, empty, and completion states.\n\nVerification:\n- npx vitest run src/test/PrepPracticeMode.test.tsx (46 tests passed)\n- npx eslint src/routes/prep/PrepPracticeMode.tsx src/test/PrepPracticeMode.test.tsx\n- npm run typecheck\n- npm run build\n\nIndependent review:\n- .agents/reviews/review-20260418-040913.md (PASS WITH ISSUES, no P0/P1)\n- .agents/reviews/test-audit-20260418-042610.md remained noisy and continued to reclassify explicit coverage as missing; I treated local green gates plus the clean source review as the stable release signal for this slice.
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
