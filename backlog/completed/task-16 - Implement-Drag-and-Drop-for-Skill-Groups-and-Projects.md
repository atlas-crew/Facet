---
id: TASK-16
title: Implement Drag-and-Drop for Skill Groups and Projects
status: Done
assignee: []
created_date: '2026-03-01 04:08'
updated_date: '2026-03-06 19:39'
labels: []
milestone: m-1
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend the existing bullet reordering DND functionality to allow users to intuitively reorder entire skill groups and project entries.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Skill groups can be reordered via drag handles.
- [x] #2 Projects can be reordered via drag handles.
- [x] #3 Order persists in the ResumeData store.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extract the 'SortableItem' pattern from 'BulletList.tsx' into a reusable utility or higher-order component.
2. Wrap 'SkillGroupList' entries in 'DndContext' and 'SortableContext'.
3. Create a 'ProjectList' component (refactoring it out of 'ComponentLibrary.tsx') and add 'dnd-kit' support.
4. Update 'onReorderSkillGroups' and 'onReorderProjects' handlers in 'App.tsx' to persist the new order in 'ResumeData'.
5. Ensure drag handles are keyboard accessible.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented full drag-and-drop reordering for Skill Groups and Projects with persistence in the ResumeData store.

Key changes:
- Extracted a reusable `useSortableItem` hook in `src/hooks/useSortableItem.ts` to consolidate `@dnd-kit/sortable` logic, providing stable drag handle props and styling.
- Refactored `ProjectList.tsx` and `SkillGroupList.tsx` to use the new hook and ensure efficient rendering via `memo` and `useCallback`.
- Verified store persistence: `reorderProjects` reorders the base projects array, and `reorderSkillGroups` recomputes vector-specific order indices.
- Improved accessibility: added visually hidden DnD instructions and descriptive aria-labels to drag handles.
- Expanded test coverage: added `src/test/SkillGroupList.test.tsx` and added reordering persistence tests in `src/test/resumeStore.test.ts`.
- All tests (314) passing.
<!-- SECTION:FINAL_SUMMARY:END -->
