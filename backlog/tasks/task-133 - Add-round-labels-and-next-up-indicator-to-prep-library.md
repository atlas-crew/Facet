---
id: TASK-133
title: Add round labels and next-up indicator to prep library
status: Done
assignee:
  - codex-library
created_date: '2026-04-16 09:47'
updated_date: '2026-04-16 10:48'
labels:
  - prep
  - library
  - ui
milestone: m-17
dependencies:
  - TASK-127
references:
  - docs/development/plans/live-cheatsheet-content-v2.md
  - src/routes/prep/PrepPage.tsx
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update the company-grouped prep library to show round progression within each company group.

**Within each company group:**
- Show the round type label on each deck card (e.g., "HM Screen", "Technical", "System Design") from deck.roundType, formatted as a human-readable label
- Most recent deck highlighted with a "Next Up" badge
- Earlier round decks visually secondary (muted border, slightly smaller text)
- Decks without a roundType show "General" or similar

**Retention limit:**
- Cap at ~5 decks per company in the visible library
- Oldest decks beyond the limit are not deleted, just hidden with an "N more" expansion link

**Sort order within group:**
- Most recent (by updatedAt) first — this is the "next up" deck
- Older decks below in reverse chronological order
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each deck card shows round type label when roundType is set
- [x] #2 Most recent deck in each company group has 'Next Up' indicator
- [x] #3 Earlier round decks have visually muted treatment
- [x] #4 Groups with >5 decks show overflow indicator
- [x] #5 Decks without roundType display gracefully
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Owner: library worker.
Scope: enhance the prep library company groups with round labels, next-up indicator, muted older rounds, and overflow handling.
Write set: PrepPage library-rendering region, related CSS, and direct UI tests only.
Validation: focused PrepPage/library tests plus typecheck for touched files.
Dependency note: consume roundType as an optional field and avoid touching generation/edit-mode regions of PrepPage.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Completed by library worker with commits 0011f93 (test(prep): add fallback round label coverage) and 2f61b13 (feat(prep): add grouped library deck styling).

Focused validation passed: npx vitest run src/test/PrepPage.test.tsx

Worker reported npm run typecheck and npm run build failing before the TASK-129 follow-up fix because of unrelated repo issues in PrepLiveMode and prepGenerator; those were outside the library lane write scope.

Residual risk remains limited to repo-level debt outside the library write set.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Updated the prep library to group decks by company, show formatted round labels with graceful fallback, mark the newest deck as Next Up, mute older decks visually, and collapse overflow past five decks per group behind an expansion control. Validation: focused PrepPage tests passed.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
