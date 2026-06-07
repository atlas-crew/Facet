---
id: TASK-288
title: 'Bullet inspector: render tags as removable pills with add control in edit mode'
status: To Do
assignee: []
created_date: '2026-06-07 20:27'
labels:
  - identity
  - ui
milestone: m-35
dependencies: []
priority: medium
ordinal: 44000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In the bullet detail view (left rail / BulletInspector), tags should render as pills rather than plain text. When edit mode is active, each pill gets an "x" affordance to remove that tag, and a "+" control adds a new tag.

This is an interaction change, not just styling: removing/adding tags must update the bullet's tags in the identity store using the existing immutable update patterns.

Relevant files: src/routes/identity/inspectorSlots/BulletInspector.tsx, src/routes/identity/identityMap.css. Follow docs/development/ui/facet-style-guide.md (status badges / pill patterns, content-typed tokens) and the immutable-state-update rule for the store mutation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Bullet tags render as pills in the bullet detail view (read mode)
- [ ] #2 In edit mode, each tag pill shows an 'x' control that removes that tag from the bullet
- [ ] #3 In edit mode, a '+' control lets the user add a new tag to the bullet
- [ ] #4 Tag add/remove persists via the identity store using immutable update patterns
- [ ] #5 Empty / whitespace-only tags cannot be added; duplicate tags are prevented or de-duplicated
- [ ] #6 Pills use design-system tokens (no hardcoded colors/spacing)
- [ ] #7 Unit test covers add and remove tag store behavior
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Regression tests pass (scoped to touched files)
- [ ] #5 Linters report no warnings or errors in touched files
- [ ] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
