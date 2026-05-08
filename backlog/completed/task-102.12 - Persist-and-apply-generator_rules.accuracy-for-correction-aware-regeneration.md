---
id: TASK-102.12
title: Persist and apply generator_rules.accuracy for correction-aware regeneration
status: Done
assignee: []
created_date: '2026-04-11 08:28'
updated_date: '2026-04-12 01:36'
labels:
  - feature
  - identity
  - research
milestone: m-16
dependencies: []
references:
  - src/identity/schema.ts
  - src/store/identityStore.ts
  - src/routes/identity/IdentityPage.tsx
  - src/utils/searchProfileInference.ts
  - src/utils/jobMatch.ts
documentation:
  - main/facet/generator-rules-accuracy-gap-in-v3-1
  - main/facet/identity-to-parameters-doc-spec
  - main/facet/professional-identity-schema-v3-1
  - main/facet/job-search-parameters-method
parent_task_id: TASK-102
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a durable, identity-native persistence layer for factual corrections to prior AI mistakes using generator_rules.accuracy, and wire regeneration flows to consume it. Keep this correction state distinct from needs-review markers so accepted user corrections survive across sessions and shape future AI-derived output.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Identity import, validation, and persistence paths support durable factual correction constraints under generator_rules.accuracy.
- [ ] #2 Correction-aware state remains distinct from needs-review markers so user acceptance state and factual constraints are not conflated.
- [ ] #3 Search vector generation, awareness generation, and identity-native inference can consume persisted generator_rules.accuracy rules during regeneration or re-analysis.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
