---
id: TASK-19
title: Implement In-Place JD Analysis Suggestions
status: Done
assignee: []
created_date: '2026-03-01 04:08'
updated_date: '2026-03-06 20:03'
labels: []
milestone: m-2
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the current JD modal with an interactive 'Suggestion Mode' that highlights recommended changes directly on the resume components.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 'Suggestion Mode' overlay on the Library cards showing proposed priority changes.
- [x] #2 One-click 'Accept/Reject' for each AI-suggested change.
- [x] #3 Visual diff in the LivePreview showing old vs. new state before applying.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a 'suggestionModeActive' boolean to 'UiState'.
2. Create a 'SuggestionOverlay' component that wraps 'ComponentCard' when suggestion mode is active.
3. Map JD analysis 'bullet_adjustments' to specific UI cards using IDs.
4. Highlight cards with suggested priority changes (e.g., a dashed border or subtle tint).
5. Add floating 'Accept' / 'Ignore' buttons over the highlighted cards.
6. Implement a 'Global Accept All' action in a new 'SuggestionToolbar'.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented interactive 'Suggestion Mode' for JD analysis, allowing users to review and apply AI recommendations directly on the resume components.

Key changes:
- Enhanced `UiState` in `src/store/uiStore.ts` with `suggestionModeActive` to track when the user is reviewing AI recommendations.
- Implemented `SuggestionToolbar.tsx` to provide global actions ("Accept All", "Discard All", "Exit") during the review process.
- Updated `ComponentCard.tsx` and `BulletList.tsx` to display a "Suggestion Overlay" when an AI recommendation is available for a specific item. The overlay shows the proposed priority change, the AI's reasoning, and provides individual "Accept" and "Ignore" actions.
- Enhanced `LivePreview.tsx` to visualize suggested inclusion changes with a subtle highlight and border, providing a real-time "visual diff" before changes are permanently applied to the store.
- Replaced the multi-step JD analysis modal with a streamlined flow that enters Suggestion Mode immediately after analysis completes.
- Verified system stability with 314 passing tests.
<!-- SECTION:FINAL_SUMMARY:END -->
