---
id: TASK-143
title: Enhance homework mode for rich content types
status: To Do
assignee: []
created_date: '2026-04-16 13:13'
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
- [ ] #1 Flashcards show title + keyPoints as question, storyBlocks on reveal
- [ ] #2 Cards with conditionals present triggers as secondary flashcards after main review
- [ ] #3 Opener filter option available in homework mode
- [ ] #4 Cards without storyBlocks fall back to existing flashcard behavior
- [ ] #5 Glance points serve as recall cues when storyBlocks absent
- [ ] #6 All existing homework functionality preserved (confidence grading, shuffle, filter counts)
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
