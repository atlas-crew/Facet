---
id: TASK-102.7
title: Move Research inference to identity-native prompts
status: Done
assignee: []
created_date: '2026-04-11 06:14'
updated_date: '2026-04-12 01:36'
labels:
  - refactor
  - identity
  - research
milestone: m-16
dependencies:
  - TASK-102.1
  - TASK-102.2
  - TASK-102.3
  - TASK-102.4
  - TASK-102.5
  - TASK-102.12
references:
  - src/utils/searchProfileInference.ts
  - src/routes/research/ResearchPage.tsx
  - src/store/identityStore.ts
documentation:
  - main/facet/generator-rules-accuracy-gap-in-v3-1
parent_task_id: TASK-102
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace or sharply reduce resumeData-shaped inference in Research by shifting remaining AI inference to identity-native prompts. Fields already carried in identity should be read directly; inference should be reserved for derived summaries or session-specific search shaping that identity does not already encode.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Research no longer depends on resumeData-shaped inference for fields already stored in identity.
- [ ] #2 Any remaining inference prompts consume identity-shaped inputs rather than raw resumeData.
- [ ] #3 Tests cover identity-native inference behavior and resume fallback behavior separately.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Quality note: do not tune identity-native inference prompts against mostly stub strategic fields. Prompt tuning should happen after structured strategic-field editors are live and at least one end-to-end identity has representative strategic data.

Correction note: identity-native prompts must include persisted generator_rules.accuracy constraints so prompt migration preserves correction-aware behavior rather than only changing field shape.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
