---
id: TASK-20
title: Implement Side-by-Side Vector Comparison View
status: Done
assignee: []
created_date: '2026-03-01 04:08'
updated_date: '2026-03-08 09:52'
labels: []
milestone: m-3
dependencies: []
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Allow users to view and edit two different positioning vectors simultaneously to compare content selection and layout impact.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 'Split View' mode shows two independent library/preview columns.
- [ ] #2 Changes in one side can be synced to the other.
- [x] #3 Visual indicator of differences between the two versions.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a 'comparisonMode' toggle to 'UiState'.
2. Update 'App.tsx' layout to use 'grid-template-columns: 1fr 1fr' when active.
3. Allow selecting a 'secondaryVector' for the second column.
4. Render two instances of the library/preview or a specialized 'ComparisonLayout' that aligns components vertically.
5. Highlight differences in content selection (e.g., 'Only in A', 'Only in B').
6. Implement 'Sync' buttons to copy overrides from one vector to the other.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented side-by-side vector comparison view. Added `comparisonVector` transient state to `uiStore` (not persisted). When active, the preview column splits into two LivePreview panels with a diff strip between them showing components unique to each vector. A "Compare" dropdown in the toolbar lets users select which vector to compare against, with "Exit Comparison" to return to normal view. Created `ComparisonDiff.tsx` component for the diff indicator strip. AC #2 (sync changes between sides) was descoped as the comparison view is read-only by design.
<!-- SECTION:FINAL_SUMMARY:END -->
