---
id: TASK-131
title: Render rich content blocks in live cheatsheet
status: Done
assignee:
  - codex-render
created_date: '2026-04-16 09:46'
updated_date: '2026-04-16 14:29'
labels:
  - prep
  - rendering
  - css
milestone: m-17
dependencies:
  - TASK-127
  - TASK-130
references:
  - docs/development/plans/live-cheatsheet-content-v2.md
  - src/routes/prep/PrepLiveMode.tsx
  - src/routes/prep/prep.css
  - .agents/skills/interview-prep/references/components.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update PrepLiveMode's SectionBlock component and add CSS for all new content block types. The renderer looks up source cards from the deck by cardId to access storyBlocks, keyPoints, metrics, and other structured content.

**Three-layer disclosure per card item:**
1. **Glance points** — if source card has `keyPoints`, render as arrow-prefixed bullet list above the detail
2. **Labeled guidance blocks** — visually differentiate script/warning/notes:
   - `script` → green left-border block with `scriptLabel` (default "Say This")
   - `warning` → red left-border block with "Caution" label
   - `notes` → blue left-border block with "Context" label
3. **Story blocks** — if source card has `storyBlocks`, render color-coded labels:
   - Problem (red), Solution (green), Result (blue), Closer (amber), Note (muted)

**Stat boxes for metrics:**
- Cards with `metrics[]` render as horizontal flex row of stat cards (large monospace value + small label)

**Questions to Ask section:**
- Q-card rendering: question text (bold) + context (italic/muted)
- Section guidance block: "Pick 2-3. Save 8-10 minutes for questions."

**Don'ts section:**
- Red X (✕) bullet list from `deck.donts[]`

**Section group headers:**
- Sidebar nav shows group labels (Intel, Core, Technical, Tactical) above their section links
- Main content shows group dividers between section groups

**Budget adjustments:**
- No per-item budget on: Questions, Don'ts, Metrics/Numbers, Intel sections

**Props change:** SectionBlock and the live mode need access to the deck's cards array (for cardId lookup) and deck-level fields (donts, questionsToAsk).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Cards with keyPoints render arrow-prefixed bullet list above detail
- [ ] #2 Script blocks render with green left border and scriptLabel
- [ ] #3 Warning blocks render with red left border and 'Caution' label
- [ ] #4 Notes blocks render with blue left border and 'Context' label
- [ ] #5 Cards with storyBlocks render color-coded Problem/Solution/Result/Closer labels
- [ ] #6 Cards without storyBlocks fall back to flat script/detail rendering
- [ ] #7 Cards with metrics render as horizontal stat box row (monospace value + label)
- [ ] #8 Questions to Ask section renders Q-cards with question + context
- [ ] #9 Don'ts section renders as red X bullet list
- [ ] #10 Section groups shown in sidebar nav and main content
- [ ] #11 No per-item budget on Questions, Don'ts, Metrics, Intel sections
- [ ] #12 All new CSS uses existing design system variables (--bg-surface, --border-subtle, etc.)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Owner: rendering worker, after TASK-130.
Scope: render rich live cheatsheet blocks from deck/card lookup in PrepLiveMode with matching prep.css updates.
Write set: src/routes/prep/PrepLiveMode.tsx, src/routes/prep/prep.css, and direct live-mode tests.
Validation: focused live-mode tests and build/typecheck for touched files.
Dependency note: do not edit PrepPage or foundation/generation files.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delivered rich live cheatsheet rendering with grouped navigation, section collapse controls, timer shortcuts, and richer card rendering for story blocks, metrics, and tactical content. Validation: commit 99e63a6, src/test/PrepLiveMode.test.tsx passed, and typecheck passed.
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
