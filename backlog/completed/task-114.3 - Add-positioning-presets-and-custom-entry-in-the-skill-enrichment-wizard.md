---
id: TASK-114.3
title: Add positioning presets and custom entry in the skill enrichment wizard
status: Done
assignee: []
created_date: '2026-04-12 23:00'
updated_date: '2026-04-12 23:13'
labels:
  - identity
  - skill-enrichment
  - frontend
dependencies: []
references:
  - src/routes/identity/IdentityEnrichmentSkillPage.tsx
  - src/test/IdentityEnrichmentSkillPage.test.tsx
  - src/routes/identity/identity.css
parent_task_id: TASK-114
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the free-text positioning examples list with a positioning preset control that offers the existing examples as selectable options while still allowing a custom value. Preserve existing saved/custom positioning content and keep positioning optional.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The positioning field presents the current positioning examples as selectable preset options.
- [x] #2 Users can choose a custom positioning path and enter any free-form positioning text.
- [x] #3 Existing saved positioning values that do not match a preset remain editable without data loss.
- [x] #4 Positioning remains optional, including the existing 'Not needed' path.
- [x] #5 Existing wizard tests are updated to cover preset selection and custom-value behavior.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced positioning examples with a preset select plus Custom path in the skill enrichment wizard. Existing non-preset positioning values now load into custom mode without data loss, positioning remains optional, and the wizard tests cover preset selection, custom entry, and the in-flight AI/depth-change race.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
