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

Implemented TASK-1 by extracting Build/ComponentLibrary mutation wiring into useComponentLibraryActions, replacing the long ComponentLibrary callback prop surface with a grouped actions API, and adding focused hook coverage for toggles, variants, add payload mapping, fallback paths, and vector-scoped bullet ordering. Independent source review passed clean on the remediated diff; scoped test audit passed with no prioritized gaps. Verification: npm run typecheck; npx vitest run src/test/useComponentLibraryActions.test.tsx src/test/BuildPage.test.tsx; npx eslint src/hooks/useComponentLibraryActions.ts src/components/ComponentLibrary.tsx src/routes/build/BuildPage.tsx src/test/useComponentLibraryActions.test.tsx; npm run lint; npm run test; npm run build; npm run format:files:check -- src/hooks/useComponentLibraryActions.ts src/components/ComponentLibrary.tsx src/routes/build/BuildPage.tsx src/test/useComponentLibraryActions.test.tsx. Repo-wide npm run format:check still fails on pre-existing formatting drift outside this task.
<!-- SECTION:NOTES:END -->
