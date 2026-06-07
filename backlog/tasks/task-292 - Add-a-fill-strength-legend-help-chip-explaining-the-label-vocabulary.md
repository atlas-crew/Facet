---
id: TASK-292
title: Add a fill-strength legend help chip explaining the label vocabulary
status: In Progress
assignee:
  - codex
created_date: '2026-06-07 20:28'
updated_date: '2026-06-07 21:10'
labels:
  - identity
  - ui
  - help
milestone: m-35
dependencies: []
priority: low
ordinal: 48000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a single help chip near the top of the Identity Map that gives a generic explanation of the fill-strength label vocabulary (e.g. solid / strong / messy / sparse / empty) used throughout the page. Today the labels appear next to sections without one place that defines what the whole vocabulary means.

This is distinct from TASK-268.6 (Done), which added per-section help chips with targeted advice next to each indicator. This task adds one generic legend/explanation of the rating scale itself, so a first-time user understands the vocabulary at a glance.

The vocabulary and tones are defined in src/utils/identityFillStrength.ts (FillStrength, FillStrengthTone, describeIdentityFillStrength). Source the legend copy from there so it stays in sync. Render near the top of src/routes/identity/IdentityMapPage.tsx using the existing help-chip component.

Relevant files: src/routes/identity/IdentityMapPage.tsx, src/utils/identityFillStrength.ts, existing help-chip component.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A help chip near the top of the Identity Map explains the full fill-strength label vocabulary in one place
- [ ] #2 The legend covers each label value and what tone (ok/warn) it represents
- [ ] #3 Legend copy is sourced from / consistent with identityFillStrength.ts so it does not drift
- [ ] #4 Uses the existing help-chip component and design-system tokens
- [ ] #5 Does not duplicate the per-section targeted advice chips from TASK-268.6
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
