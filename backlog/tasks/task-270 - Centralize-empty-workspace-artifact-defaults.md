---
id: TASK-270
title: Centralize empty workspace artifact defaults
status: To Do
assignee: []
created_date: '2026-06-01 14:39'
labels:
  - refactor
  - remediation
dependencies: []
modified_files:
  - src/persistence/snapshot.ts
  - src/persistence/runtime.ts
  - src/test/persistenceRuntime.test.ts
priority: medium
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deferred from the clear-workspace review after aaa66c6. createEmptyWorkspaceSnapshot currently hand-codes empty payloads for pipeline, JD analysis, prep, cover letters, LinkedIn, recruiter, debrief, and research while resume uses normalizeResumeWorkspaceData(undefined). This can drift when a store's durable shape changes. Move each artifact's empty/default workspace payload behind a store-owned helper or shared typed factory, then have createEmptyWorkspaceSnapshot consume those helpers so empty workspace snapshots stay aligned with store normalization.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each durable artifact has one canonical empty workspace payload helper or documented default source.
- [ ] #2 createEmptyWorkspaceSnapshot consumes those helpers instead of inline ad hoc payload literals.
- [ ] #3 A regression test fails if an artifact type is added without an empty payload default.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inventory durable artifact payload defaults and existing normalize/migrate helpers.\n2. Add store-owned or persistence-owned typed empty payload factories for non-resume artifacts.\n3. Refactor createEmptyWorkspaceSnapshot to consume the factories and retain snapshot validation.\n4. Add/adjust tests so artifact-type/default drift is caught.
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
