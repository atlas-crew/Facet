---
id: TASK-1
title: Refactor resume mutation flow out of App.tsx
status: In Progress
assignee:
  - '@codex'
created_date: '2026-02-28 05:46'
updated_date: '2026-05-28 16:41'
labels:
  - remediation
  - refactor
dependencies: []
references:
  - .agents/reviews/review-20260227-175002.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Review feedback flags App.tsx/ComponentLibrary prop-drilling and inline mutation callbacks as a maintainability/performance risk. Move mutation logic into reusable actions (store or dedicated hook) and shrink component interfaces.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 App.tsx no longer defines inline data mutation callbacks for each entity type
- [x] #2 ComponentLibrary callback prop count is materially reduced
- [x] #3 Behavior parity is preserved for add/edit/reorder/toggle flows
- [x] #4 Verification commands pass
<!-- AC:END -->









## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extract granular mutation actions for target lines/profiles/projects/bullets/skills into a single action surface.
2. Replace inline update lambdas in App.tsx with stable function references.
3. Reduce ComponentLibrary prop footprint by passing grouped action APIs.
4. Re-run lint/typecheck/test/build and document API changes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Starting TASK-1. Current App.tsx is already a re-export; the live mutation surface is BuildPage -> ComponentLibrary. I will treat the task as refactoring that current BuildPage/ComponentLibrary boundary: move component-library mutation wiring into a reusable build hook and collapse the many callback props into a grouped action API while preserving store-backed behavior.
<!-- SECTION:NOTES:END -->
