---
id: TASK-130
title: Update cheatsheet derivation for new sections and groups
status: Done
assignee:
  - codex-render
created_date: '2026-04-16 09:46'
updated_date: '2026-04-16 14:29'
labels:
  - prep
  - derivation
milestone: m-17
dependencies:
  - TASK-127
references:
  - docs/development/plans/live-cheatsheet-content-v2.md
  - src/utils/prepCheatsheet.ts
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update derivePrepCheatsheetSections to produce Questions to Ask, Don'ts sections from deck-level fields, attach category guidance, and add group metadata for sidebar grouping.

**New sections to derive:**
- "Questions to Ask" — from `deck.questionsToAsk[]`, placed in Tactical group
- "Don'ts" — from `deck.donts[]`, placed in Tactical group

**Group metadata on all sections:**
- Intel group: overview, intel
- Core group: opener, behavioral, project
- Technical group: technical, situational
- Tactical group: questions, donts, metrics, warnings

**Category guidance:**
- Read `deck.categoryGuidance` and attach matching guidance string to each section

**Derivation passes cardId, not rich content:**
- Items keep existing `cardId` field. The renderer will look up the source card from the deck when it needs storyBlocks, keyPoints, or metrics. The derivation does NOT mirror these fields onto items.

**No truncation on structured content:**
- The existing `truncate(text, 320)` stays for flat text detail. Structured content (storyBlocks etc.) is accessed via cardId lookup, not through the derivation layer.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Questions to Ask section derived from deck.questionsToAsk when present
- [ ] #2 Don'ts section derived from deck.donts when present
- [ ] #3 Every section has a group field (Intel, Core, Technical, or Tactical)
- [ ] #4 Section guidance attached from deck.categoryGuidance
- [ ] #5 Derivation does NOT copy storyBlocks/keyPoints/metrics onto items
- [ ] #6 Existing sections (overview, intel, category-based, warnings) continue to work
- [ ] #7 Empty questionsToAsk/donts arrays do not produce empty sections
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Owner: rendering worker.
Scope: update src/utils/prepCheatsheet.ts to derive Questions to Ask, Don'ts, guidance, and group metadata without mirroring rich card content onto derived items.
Write set: src/utils/prepCheatsheet.ts and directly related derivation tests only.
Validation: focused derivation tests plus targeted typecheck.
Dependency note: may assume TASK-127 adds the required optional deck/card fields; do not modify foundation files.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Derived grouped prep cheatsheet sections from deck metadata and card categories, including tactical questions and donts blocks plus round-aware guidance. Validation: commit 99e63a6, targeted live-mode tests passed, and typecheck passed.
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
