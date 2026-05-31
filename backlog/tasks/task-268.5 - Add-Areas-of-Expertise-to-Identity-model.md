---
id: TASK-268.5
title: Add Areas of Expertise to Identity model
status: To Do
assignee: []
created_date: '2026-05-31 20:48'
labels:
  - feature
  - identity
  - schema
dependencies: []
references:
  - TODO.md
modified_files:
  - src/identity/schema.ts
  - src/routes/identity/IdentityMapPage.tsx
  - src/utils/identityExtraction.ts
parent_task_id: TASK-268
priority: medium
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TODO requests an Areas of Expertise / Subject Matter Expert field separate from skills. This should model domains of expertise, not tool proficiency. Examples might include payments security, developer productivity, observability cost control, compliance automation, or distributed systems migration.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Identity schema has a first-class expertise/SME field separate from skills.
- [ ] #2 Expertise entries can cite supporting roles/projects/bullets or source context.
- [ ] #3 Identity Map provides review/edit controls for expertise entries.
- [ ] #4 Downstream generators can read expertise without treating it as a skill list.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Decide whether expertise belongs under identity.self_model, a new identity.expertise section, or another candidate-only identity field.
2. Add schema, normalization, sample fixture, and persistence coverage.
3. Update extraction prompts/normalizers to infer expertise with evidence references and needs-review status.
4. Add Map rendering/editing and focused tests.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Regression tests pass (scoped to touched files)
- [ ] #5 Linters report no warnings or errors in touched files
- [ ] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
