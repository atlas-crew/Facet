---
id: TASK-290
title: 'AI feature: suggest standardized skill group names'
status: In Progress
assignee:
  - '@codex'
created_date: '2026-06-07 20:28'
updated_date: '2026-06-08 02:56'
labels:
  - identity
  - skills
  - ai
milestone: m-35
dependencies: []
priority: medium
ordinal: 46000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add an AI action that proposes improved, standardized names for the user's skill groups. It renames all groups in one pass; the user can then edit any name they don't like. Per-group revert buttons are nice-to-have and may be deferred if they add significant complexity.

This pairs with the existing taxonomy work (generic-group-name detection already exists in identityFillStrength / identityEnrichment). The suggestion should avoid generic labels and reflect the skills contained in each group.

Follow the established identity AI-action pattern (endpoint guard, generating state, proposal-then-apply where appropriate — see how skill enrichment and proposeAnswerPatch flows are wired). Sonnet-tier model is likely sufficient.

Relevant files: src/routes/identity/bands/SkillsBand.tsx, src/routes/identity/inspectorSlots/SkillGroupInspector.tsx, src/store/identityStore.ts (updateCurrentSkillGroups), a new generator in src/utils/ alongside the existing identity generators.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A single AI action proposes new names for all skill groups in one pass
- [ ] #2 Applying the suggestion renames every group; user can subsequently edit any group name
- [ ] #3 Suggested names avoid generic labels (reuse existing generic-label detection) and reflect each group's contents
- [ ] #4 Action follows the identity AI-action UX pattern (proxy guard, busy/generating state, error handling)
- [ ] #5 Rename apply uses immutable store updates and does not lose group metadata (positioning, calibration, differentiator, items)
- [ ] #6 Per-group revert is implemented OR explicitly deferred with a follow-up note
- [ ] #7 Unit test covers applying suggested group names to the store
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
