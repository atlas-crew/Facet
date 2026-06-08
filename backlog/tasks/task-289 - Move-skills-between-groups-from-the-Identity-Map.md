---
id: TASK-289
title: Move skills between groups from the Identity Map
status: In Progress
assignee:
  - '@codex'
created_date: '2026-06-07 20:28'
updated_date: '2026-06-08 00:37'
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
- [ ] #1 Skill item detail view offers a target-group selector and a Move-to action
- [ ] #2 Selecting a target group and confirming moves the skill out of its current group into the target group
- [ ] #3 The skill's enrichment metadata (depth, positioning, calibration, evidence, tags) is preserved across the move
- [ ] #4 Moving into a group that already has a same-named skill de-duplicates rather than creating a duplicate
- [ ] #5 The current group is excluded from / disabled in the target-group selector
- [ ] #6 Move persists via immutable store update patterns
- [ ] #7 Unit test covers the move-between-groups store behavior including metadata preservation
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
