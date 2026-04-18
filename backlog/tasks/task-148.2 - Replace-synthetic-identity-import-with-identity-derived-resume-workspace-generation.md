---
id: TASK-148.2
title: >-
  Replace synthetic identity import with identity-derived resume workspace
  generation
status: To Do
assignee: []
created_date: '2026-04-18 11:00'
updated_date: '2026-04-18 11:00'
labels:
  - resume
  - build
  - identity
milestone: m-19
dependencies:
  - TASK-148.1
references:
  - src/identity/resumeAdapter.ts
  - src/identity/schema.ts
  - src/store/identityStore.ts
  - src/engine/serializer.ts
  - src/routes/build/BuildPage.tsx
parent_task_id: TASK-148
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the current Professional Identity import path that collapses everything into the synthetic identity-default vector. Build should derive its baseline workspace from Professional Identity, including real search vectors and identity-backed resume evidence, so identity becomes the primary authoring source for resume generation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Identity-to-resume derivation uses current Professional Identity data as the baseline Build source instead of a synthetic single-vector adapter.
- [ ] #2 Identity search vectors are available as first-class Build vectors when present, with sensible fallback behavior when identity vectors are missing.
- [ ] #3 Derived resume content includes identity-backed target lines, profiles, skills, roles, and projects in a way later vector selection and assembly tasks can consume.
- [ ] #4 Import/export or launch flows that currently depend on the synthetic adapter continue to work or are intentionally migrated with clear behavior.
- [ ] #5 Targeted tests cover identity derivation behavior and fallback cases.
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
