---
id: TASK-268.7
title: Deepen projects with structured evidence like bullets
status: Done
assignee: []
created_date: '2026-05-31 20:48'
updated_date: '2026-06-07 20:31'
labels:
  - feature
  - identity
  - projects
  - inference
milestone: m-35
dependencies: []
references:
  - TODO.md
modified_files:
  - src/identity/schema.ts
  - src/types/identity.ts
  - src/types/hosted.ts
  - src/utils/identityExtraction.ts
  - src/routes/identity/inspectorSlots/ProjectInspector.tsx
  - src/test/ProjectInspector.deepen.test.tsx
  - src/test/identityExtraction.test.ts
  - src/test/professionalIdentity.test.ts
parent_task_id: TASK-268
priority: medium
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TODO notes that projects need deepening like other bullets and may require model expansion. Current project inspector editing exists, but project entries do not appear to have the same AI decomposition/deepening path as role bullets.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Projects have a defined deepened structure or evidence model comparable to bullet decomposition where appropriate.
- [x] #2 Users can run project deepening for an individual project and review/correct the result.
- [x] #3 Project deepening preserves source context, technologies, metrics, assumptions, and evidence boundaries.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect current project schema and downstream consumers before changing shape.
2. Decide whether projects gain bullet-like subclaims or a project-specific evidence structure.
3. Add generator/normalizer support with explicit assumptions and source preservation.
4. Add ProjectInspector affordance and tests.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added project evidence fields and AI project deepening with source preservation, non-destructive sparse-result merges, warnings/assumption notes, metrics validation, and focused regression coverage. Verified with typecheck, focused Vitest, touched-file lint, and agent-loop specialist review/test audits.
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
