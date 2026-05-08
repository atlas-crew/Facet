---
id: TASK-123.1
title: Group Facet app navigation into journey-based workspace sections
status: Done
assignee:
  - codex
created_date: '2026-04-14 12:41'
updated_date: '2026-04-14 13:25'
labels:
  - ux
  - navigation
  - app-shell
dependencies: []
references:
  - src/components/AppShell.tsx
  - .agents/reviews/review-20260414-091847.md
  - .agents/reviews/test-audit-20260414-092158.md
parent_task_id: TASK-123
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update the shared app shell so the main navigation reflects the product journey rather than a flat list of peer routes. The result should make Core, Execution, Output, and utility areas easier to scan and should improve orientation across the product.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The main navigation groups workspaces into product-meaningful sections instead of one undifferentiated list.
- [x] #2 The active route and active group remain clear across desktop and responsive layouts.
- [x] #3 The top-level shell exposes clearer route context so users can tell what workspace they are in and how it fits into the larger system.
- [x] #4 Navigation updates preserve existing route access and keyboard usability.
- [x] #5 Relevant shell tests and copy are updated, and the slice verifies with typecheck, targeted tests, and build.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Review the current AppShell navigation render path and any AppShell tests or shared shell styles that assume a flat nav list.
Refactor the shell navigation into grouped sections that reflect the Facet journey while preserving existing route links, active-state behavior, and keyboard usability.
Add clearer top-level route context in the shell so the current workspace reads as part of a grouped system rather than an isolated tool.
Update AppShell tests and any affected shell copy or structure assertions to match the grouped navigation model.
Verify the slice with npm run typecheck, targeted vitest for AppShell, targeted eslint on touched files, and npm run build before committing with cortex git commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Grouped the flat AppShell navigation into Core/Execution/Output workspace sections, added route metadata for topbar context, and introduced a shared eyebrow/title/description shell treatment without touching downstream workspace routes. Tightened typing between NAV_ITEMS and NAV_GROUPS so grouped route references stay compiler-checked.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added grouped workspace navigation and route-context topbar copy in AppShell, updated AppShell coverage for the new grouped nav shell and retry action, and verified with typecheck, targeted AppShell vitest, targeted eslint, and build. Independent review passed with issues in .agents/reviews/review-20260414-091847.md; broader AppShell coverage gaps were captured in follow-up task creation.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
