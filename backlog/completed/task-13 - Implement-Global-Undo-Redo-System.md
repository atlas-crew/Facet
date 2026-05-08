---
id: TASK-13
title: Implement Global Undo/Redo System
status: Done
assignee: []
created_date: '2026-03-01 04:08'
updated_date: '2026-03-01 05:58'
labels: []
milestone: m-1
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement a comprehensive undo/redo stack for all resume data and theme mutations to provide a safety net for users during intensive editing sessions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Keyboard shortcuts (Cmd/Ctrl + Z, Cmd/Ctrl + Shift + Z) trigger undo/redo.
- [x] #2 UI shows undo/redo buttons in the top bar.
- [x] #3 Stack captures ResumeData and ResumeThemeOverrides changes.
- [x] #4 Stack depth is limited to 50 operations.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Install 'zundo' or implement custom history middleware for the Zustand store.
2. Define 'ResumeHistory' state to track the past and future stacks.
3. Update 'useResumeStore' to wrap data mutations in the history tracker.
4. Add 'undo' and 'redo' actions to the store.
5. Create an 'UndoRedoControls' component in 'App.tsx' top bar.
6. Register global keydown listeners for 'Mod+Z' and 'Mod+Shift+Z'.
7. Ensure 'localStorage' persistence correctly handles the current state while ignoring the history stack.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented global undo/redo by embedding a past/future history stack directly in resumeStore. Every `setData` and `resetToDefaults` call pushes the previous state to the stack (capped at 50). The history arrays are excluded from localStorage via `partialize`.\n\nFiles changed:\n- `src/store/resumeStore.ts` — added `past`, `future`, `undo()`, `redo()`, and `partialize` to persist config\n- `src/components/UndoRedoControls.tsx` — new component with Undo2/Redo2 icon buttons, disabled state tied to stack emptiness\n- `src/App.tsx` — imported UndoRedoControls, mounted in top-bar-actions, added Cmd+Z / Cmd+Shift+Z keyboard shortcuts to handleGlobalKeyDown\n- `src/index.css` — added `.undo-redo-controls` styling with separator border\n- `src/test/undoRedo.test.ts` — 10 tests covering push, undo, redo, cycles, future clearing, no-op on empty, stack depth limit, and resetToDefaults tracking
<!-- SECTION:FINAL_SUMMARY:END -->
