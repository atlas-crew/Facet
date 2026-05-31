---
id: TASK-268.8
title: Add Identity jump-to-next-needs-attention navigation
status: To Do
assignee: []
created_date: '2026-05-31 20:48'
labels:
  - feature
  - identity
  - ux
dependencies: []
references:
  - TODO.md
modified_files:
  - src/routes/identity/IdentityMapPage.tsx
  - src/store/identityStore.ts
  - src/utils/identityFillStrength.ts
parent_task_id: TASK-268
priority: medium
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TODO requests a way to jump to the next Identity item needing user attention or correction. This should work across Map bands and should prioritize actionable gaps, failed/needs-review inference, messy skills, sparse sections, and assumptions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Identity Map exposes a Next attention item action when actionable gaps exist.
- [ ] #2 The action selects/focuses the relevant inspector slot and advances through a stable ordered queue.
- [ ] #3 The queue includes assumptions, failed or skipped inference, sparse/messy fill-strength signals, and unreviewed inferred items.
- [ ] #4 Empty state clearly says there are no attention items.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define an attention-item derivation helper from currentIdentity + transient inference state.
2. Map each item to an existing MapSelection discriminant or a band-level selection.
3. Add navigation controls and focus management to IdentityMapPage/IdentityInspector.
4. Test ordering, stale selection fallback, and no-items behavior.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Regression tests pass (scoped to touched files)
- [ ] #5 Linters report no warnings or errors in touched files
- [ ] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
