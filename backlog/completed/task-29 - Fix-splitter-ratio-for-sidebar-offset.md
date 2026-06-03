---
id: TASK-29
title: Fix splitter ratio calculation to account for sidebar width
status: Done
assignee:
  - '@codex'
created_date: '2026-03-07 12:00'
updated_date: '2026-05-27 21:23'
labels: []
milestone: m-4
dependencies: []
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The panel splitter drag handler in BuildPage uses `event.clientX / window.innerWidth` which doesn't account for the 48px sidebar. This makes the panel ratio feel slightly off — dragging to visual center doesn't produce a 50/50 split.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Splitter drag calculation accounts for sidebar width: `(event.clientX - 48) / (window.innerWidth - 48)`
- [ ] #2 Panel ratio feels correct — visual midpoint = 0.5 ratio
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. In `src/routes/build/BuildPage.tsx`, find the `onMouseMove` handler inside the `draggingSplit` effect (around line 310).
2. Change `event.clientX / window.innerWidth` to `(event.clientX - 48) / (window.innerWidth - 48)`.
3. Consider extracting `48` as a `SIDEBAR_WIDTH` constant shared with AppShell CSS.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-05-27 Codex starting TASK-29 as part of m-4 completion push. Plan: inspect BuildPage splitter drag logic, update sidebar-aware ratio calculation, add focused regression coverage if a suitable BuildPage/UI test hook exists, run focused validation, and commit atomically.

Closed as satisfied in current build: BuildPage splitter ratio already subtracts the 48px sidebar width before dividing by the content width, and npx vitest run src/test/BuildPage.test.tsx passes (20 tests).
<!-- SECTION:NOTES:END -->
