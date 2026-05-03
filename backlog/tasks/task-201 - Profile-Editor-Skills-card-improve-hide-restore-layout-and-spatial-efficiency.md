---
id: TASK-201
title: 'Profile Editor Skills card: improve hide/restore layout and spatial efficiency'
status: To Do
assignee: []
created_date: '2026-04-30 11:43'
labels:
  - research
  - profile-editor
  - ux
  - follow-up
dependencies: []
references:
  - src/routes/research/searchWorkspaceComponents.tsx
  - src/routes/research/research.css
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User feedback on the Profile Editor → Skills card (`<SearchSkillsTable>` in `src/routes/research/searchWorkspaceComponents.tsx`):

1. **Wasted vertical space** — even with the "Show context" toggle hiding the Context column, the table feels heavy. Each row uses a full-width line for Skill + Depth + (X). User screenshot showed truncation that defeats the table layout.
2. **No restore affordance** — when a user hides a skill from this search, it disappears from the list with no clear way to add it back. Today the only restore path is "Generate a thesis with the hidden skill un-hidden in `searchOverrides.hiddenSkillIds`," which isn't discoverable.

## Proposed fix shape

- **Below-the-fold hidden skills section.** Render a "Hidden from this search (N)" disclosure below the active list. Each row in the disclosure has the skill name + a Restore button that toggles the hidden state off.
- **Tighter active-list rows.** Move depth from its own column to a chip on the skill row (one row = "Skill name [DEPTH]  X"). Frees ~30% horizontal space.
- Optionally: an inline tooltip-on-hover for context (not a column toggle), keeping each row to a single line.

## Acceptance Criteria

- Hidden skills appear in a "Hidden from this search" disclosure below the active list with a per-row Restore button.
- Active rows use a single horizontal line with skill name, depth chip, and hide button — no row wrapping at the default Profile Editor width.
- Toggling hide/restore round-trips through `toggleThesisHiddenSkill` (no new store mutator needed).
- Existing tests for the Skills card continue to pass; new test asserts a hidden skill appears in the disclosure with a working Restore.

## Out of scope

- Migrating Skills calibration to the Thesis Map. That's part of the Map plan's Phase 4 (Calibration band) and is a different surface; this task is purely about the Profile Editor's per-search hide/show table.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
