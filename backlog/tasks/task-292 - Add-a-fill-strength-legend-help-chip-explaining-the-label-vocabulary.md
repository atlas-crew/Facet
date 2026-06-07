---
id: TASK-292
title: Add a fill-strength legend help chip explaining the label vocabulary
status: Done
assignee:
  - codex
created_date: '2026-06-07 20:28'
updated_date: '2026-06-07 21:30'
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
- [x] #1 A help chip near the top of the Identity Map explains the full fill-strength label vocabulary in one place
- [x] #2 The legend covers each label value and what tone (ok/warn) it represents
- [x] #3 Legend copy is sourced from / consistent with identityFillStrength.ts so it does not drift
- [x] #4 Uses the existing help-chip component and design-system tokens
- [x] #5 Does not duplicate the per-section targeted advice chips from TASK-268.6
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a topbar Fill strength help chip for the Identity Map. The legend is sourced from identityFillStrength.ts via an exhaustive label-keyed vocabulary map, uses user-facing tone labels while preserving ok/warn data, and is covered in populated and empty identity states.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a band-agnostic fill-strength legend HelpHint near the Identity Map topbar stats. The legend vocabulary is defined in identityFillStrength.ts, derives its exported order from an exhaustive label-keyed map, and renders user-facing ready/needs-attention tone copy. Covered utility serialization, per-label tone mappings, focus reveal behavior, and empty-state render behavior.
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
