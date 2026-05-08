---
id: TASK-114.7
title: Refine positioning presets and custom examples in skill enrichment
status: Done
assignee: []
created_date: '2026-04-12 23:57'
updated_date: '2026-04-13 00:04'
labels:
  - identity
  - skill-enrichment
  - ux-copy
dependencies: []
references:
  - src/routes/identity/IdentityEnrichmentSkillPage.tsx
  - src/test/IdentityEnrichmentSkillPage.test.tsx
parent_task_id: TASK-114
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make the positioning dropdown more generic by removing Python/Linux-specific presets, and move those references into a custom-only examples section with additional concrete examples.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The positioning preset dropdown uses generic recruiter-facing options only.
- [x] #2 Python/Linux-specific positioning references appear only in the custom guidance examples.
- [x] #3 The wizard tests are updated for the new preset and custom-example behavior.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Updated the positioning preset dropdown to generic recruiter-facing options only, moved Python/Linux-specific references into a custom-only examples section, added more concrete custom examples, and refreshed the wizard test expectations around preset vs custom behavior.
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
