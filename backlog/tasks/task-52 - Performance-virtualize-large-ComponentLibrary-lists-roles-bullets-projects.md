---
id: TASK-52
title: 'Performance: virtualize large ComponentLibrary lists (roles/bullets/projects)'
status: In Progress
assignee:
  - '@codex'
created_date: '2026-03-10 03:54'
updated_date: '2026-05-28 15:08'
labels:
  - performance
milestone: m-1
dependencies:
  - TASK-1
  - TASK-2
modified_files:
  - src/components/VirtualizedList.tsx
  - src/components/BulletList.tsx
  - src/components/ProjectList.tsx
  - src/components/ComponentLibrary.tsx
  - src/index.css
  - src/test/VirtualizedList.test.tsx
  - src/test/BulletList.test.tsx
  - src/test/ProjectList.test.tsx
  - src/test/DndOverlayState.test.tsx
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
For large resumes, rendering every card/bullet can be slow. Introduce list virtualization for the largest sections while preserving DnD and keyboard navigation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Roles/bullets (and at least one other large section) are virtualized to reduce DOM/render cost.
- [x] #2 Drag-and-drop still works correctly; keyboard access remains intact.
- [x] #3 No visual regressions in normal-sized datasets.
- [x] #4 Verification commands pass.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Codex starting TASK-52. Plan: add an internal measured virtual-list primitive that falls back to the existing DOM for normal-sized lists; apply it to ComponentLibrary roles, per-role bullets, and projects above conservative thresholds so DnD/keyboard affordances remain intact for rendered items; add focused regression tests for normal-list parity and large-list DOM reduction; run independent review/audit plus lint/test/build; commit via cortex.

Implemented a measured VirtualizedList primitive and applied it to large bullet/project lists while preserving normal-sized rendering, sortable placeholders, forced active drag rows, keyboard drag handles, ARIA list metadata, ResizeObserver measurement, and no-ResizeObserver fallback. Roles remain non-virtualized to preserve existing accordion state and avoid nested scroll regressions; the heavy role bullet content is virtualized instead.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented measured virtualization for large Build library bullet and project lists. Added sortable placeholder rows plus drag overlays so dnd-kit keeps offscreen drop targets while the active dragged card remains mounted; normal-sized lists still render the existing flat DOM. Added VirtualizedList coverage for measurement, gap math, accessibility metadata, forced rows, ResizeObserver cleanup, and no-ResizeObserver fallback, plus BulletList/ProjectList/DnD overlay regression tests. Verification: focused Vitest 4 files / 17 tests passed; npm run typecheck passed; scoped ESLint passed; npm run lint passed; npm run test passed (180 files / 2735 tests); npm run build passed with existing large chunk warnings; format:files:check passed for the changed files. Independent source review used direct Gemini after script-provider contract failures and found only a nonblocking P3 viewport-height suggestion, addressed with responsive max-height. Final diff test audit passed with 10 covered behaviors and no prioritized gaps. No documentation changes were required for this internal performance slice.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Documentation has been created/modified/removed as needed.
- [x] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [x] #4 Test changes were approved by a test gap analysis review
- [x] #5 Changes to integration points are covered by tests
- [x] #6 All tests pass successfully
- [x] #7 Automatic formatting was applied.
- [x] #8 Linters report no WARNINGS or ERRORS
- [x] #9 The project builds successfully
<!-- DOD:END -->
