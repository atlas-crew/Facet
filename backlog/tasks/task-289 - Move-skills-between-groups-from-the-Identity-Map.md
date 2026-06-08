---
id: TASK-289
title: Move skills between groups from the Identity Map
status: Done
assignee:
  - '@codex'
created_date: '2026-06-07 20:28'
updated_date: '2026-06-08 01:09'
labels:
  - identity
  - skills
milestone: m-35
dependencies: []
priority: medium
ordinal: 45000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Users need to reorganize their skill taxonomy by moving a skill from one group to another. Editing a group's name already works (SkillGroupInspector supports renaming the label); this task adds the missing "move skill to another group" capability.

For now a dropdown of target groups plus a "Move to" button is sufficient — drag-and-drop can come later. Place the control in the skill item detail view (SkillItemInspector).

The move must reassign the skill item between groups using immutable store updates (see updateCurrentSkillGroups / removeSkillFromCurrentIdentity in src/store/identityStore.ts), preserving the skill's enrichment metadata (depth, positioning, evidence, tags) across the move, and de-duplicating if a same-named skill already exists in the target group.

Relevant files: src/routes/identity/inspectorSlots/SkillItemInspector.tsx, src/store/identityStore.ts. Note: group rename already exists and is out of scope.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Skill item detail view offers a target-group selector and a Move-to action
- [x] #2 Selecting a target group and confirming moves the skill out of its current group into the target group
- [x] #3 The skill's enrichment metadata (depth, positioning, calibration, evidence, tags) is preserved across the move
- [x] #4 Moving into a group that already has a same-named skill de-duplicates rather than creating a duplicate
- [x] #5 The current group is excluded from / disabled in the target-group selector
- [x] #6 Move persists via immutable store update patterns
- [x] #7 Unit test covers the move-between-groups store behavior including metadata preservation
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented skill moves from the Identity Map inspector with target-group selection, immutable store move/merge behavior, duplicate merge metadata precedence, and focused store/UI regression coverage. Verification: focused identityStore + IdentityMapEditing tests, ESLint on touched files, typecheck, specialist review, and diff test audit.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added Move/Move & merge controls to the skill item inspector, a store-level moveSkillBetweenCurrentGroups action with metadata-preserving duplicate merges, and regression tests for move, merge, no-op, target fallback, ARIA hint, and tag dedupe behavior.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 Automatic formatting was applied to touched files
- [x] #4 Regression tests pass (scoped to touched files)
- [x] #5 Linters report no warnings or errors in touched files
- [x] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
