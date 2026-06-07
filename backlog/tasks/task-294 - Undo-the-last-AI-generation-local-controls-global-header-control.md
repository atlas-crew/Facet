---
id: TASK-294
title: Undo the last AI generation (local controls + global header control)
status: To Do
assignee: []
created_date: '2026-06-07 20:29'
labels:
  - identity
  - ai
  - ux
milestone: m-35
dependencies: []
priority: medium
ordinal: 50000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Users need a way to revert an AI generation they don't like. Provide undo for the last AI generation — either local per-section undo buttons, a single global undo control in the header that reverts the most recent AI generation, or both. The header global undo is the priority outcome since it covers every generator uniformly.

Design considerations:
- Capture a pre-generation snapshot of the affected identity slice when an AI action runs, so undo restores exactly that slice.
- Scope: this is undo for AI generations specifically (not a general edit-history system). Decide and document how deep the undo stack goes (at minimum: revert the single most recent AI generation).
- Must integrate with the existing identity store and immutable update patterns; the snapshot/restore must not corrupt other unrelated edits made after the generation (define and document this boundary).

This interacts with the downstream-regeneration work — undoing an upstream regenerate should leave downstream-stale indicators in a sensible state (document the chosen behavior).

Relevant files: src/store/identityStore.ts, src/routes/identity/IdentityMapPage.tsx, the app header/shell component, the bands/ generators.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A global header control reverts the most recent AI generation
- [ ] #2 Undo restores the exact identity slice that the generation changed
- [ ] #3 The depth of the undo stack is defined and documented (at minimum: most recent generation)
- [ ] #4 Undo behavior when later unrelated edits exist is defined and does not silently clobber them
- [ ] #5 Undo integrates with the identity store via immutable update patterns
- [ ] #6 Per-section local undo is implemented OR explicitly deferred with rationale
- [ ] #7 Unit test covers snapshot-then-undo restoring the prior slice
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
