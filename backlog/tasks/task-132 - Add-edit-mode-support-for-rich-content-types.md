---
id: TASK-132
title: Add edit mode support for rich content types
status: Done
assignee:
  - codex
created_date: '2026-04-16 09:47'
updated_date: '2026-04-16 14:29'
labels:
  - prep
  - edit-mode
  - ui
milestone: m-17
dependencies:
  - TASK-127
  - TASK-131
references:
  - docs/development/plans/live-cheatsheet-content-v2.md
  - src/routes/prep/PrepCardView.tsx
  - src/routes/prep/PrepPage.tsx
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add editors for the new content fields in PrepCardView and the deck-level "Active Prep Set" panel in PrepPage.

**Card-level editors in PrepCardView:**
1. **StoryBlocks editor** — when a card has storyBlocks, show a structured editor: each block has a label selector (problem/solution/result/closer/note) and a textarea. Add/remove block buttons. Fallback: if no storyBlocks, show the existing flat script textarea.
2. **KeyPoints editor** — simple string list editor (one input per point, add/remove). Similar to existing tags editor pattern.
3. **ScriptLabel editor** — text input next to the script textarea, defaults to "Say This".

**Deck-level editors in PrepPage "Active Prep Set" panel:**
4. **Don'ts editor** — string list editor. Each don't is a single-line input. Add/remove buttons.
5. **Questions to Ask editor** — list of {question, context} pairs. Each entry has two inputs (question text + coaching context). Add/remove buttons.
6. **Round type selector** — dropdown in "Deck Basics" section alongside company/role/vector. Options from InterviewFormat union. When deck is linked to a pipeline entry, pre-populate options from the entry's format[] array.
7. **Category guidance editor** — collapsible section in deck settings. One textarea per category that has cards. Optional, for power users.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 StoryBlocks editor renders label selector + textarea per block with add/remove
- [ ] #2 Cards without storyBlocks still show flat script textarea
- [ ] #3 KeyPoints editor renders one input per point with add/remove
- [ ] #4 Don'ts editor in Active Prep Set panel with add/remove
- [ ] #5 Questions editor in Active Prep Set panel with question + context fields
- [ ] #6 Round type dropdown in Deck Basics, uses InterviewFormat values
- [ ] #7 All editors persist changes through existing onUpdateCard/updateDeck flows
- [ ] #8 TypeScript compiles cleanly
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Owner: main rollout (codex) after TASK-131 is available.
Scope: add rich-content editors in PrepCardView and deck-level controls in PrepPage while preserving existing update flows.
Validation: PrepCardView/PrepPage tests plus typecheck/build for touched slices.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added edit-mode support for deck-level round guidance and rich card editing, including collapsible detail editors, draft-preserving store updates, export sanitization, and live-surface filtering for draft rows. Validation: commit f9ee38d, npm run typecheck, and prep-focused Vitest suite passed (PrepCardView, PrepPage, PrepLiveMode, prepStore).
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
