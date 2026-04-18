---
id: TASK-148.1
title: Add resume generation mode and handoff foundations
status: Done
assignee:
  - Codex
created_date: '2026-04-18 11:00'
updated_date: '2026-04-18 11:39'
labels:
  - resume
  - build
  - identity
  - pipeline
milestone: m-19
dependencies: []
references:
  - src/store/resumeStore.ts
  - src/store/handoffStore.ts
  - src/store/pipelineStore.ts
  - src/types/pipeline.ts
  - src/routes/pipeline/PipelineEntryModal.tsx
parent_task_id: TASK-148
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Introduce the shared state and data model needed for identity-first resume generation. This foundation should define explicit resume generation modes, structured generation context, and handoff metadata so later tasks can build single, multi-vector, and dynamic workflows without overloading the current selectedVector and free-text resumeVariant fields.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Shared types and persisted state can represent single, multi-vector, and dynamic per-job resume generation modes.
- [x] #2 Build handoff state can carry structured generation context from pipeline and other launch points without depending only on jd plus vectorId.
- [x] #3 Pipeline metadata no longer relies on free-text resumeVariant for generated resume state and instead has a structured representation suitable for downstream tasks.
- [x] #4 Existing resume workspace hydration and migrations continue to load safely with backward-compatible defaults or migrations.
- [x] #5 Targeted tests cover the new state model, migrations, and handoff behavior.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define explicit resume-generation mode and source types shared by Build, Pipeline, and handoff state.
2. Add structured handoff payload support while preserving compatibility with the existing jd/vectorId entrypoint.
3. Replace pipeline's free-text generated resume metadata dependency with a structured resumeGeneration field and migrate persisted entries safely.
4. Add generation metadata to the resume workspace store so later tasks can initialize and persist mode-aware workspaces without refactoring the store again.
5. Add targeted tests for handoff consume/set behavior, pipeline migration/normalization, and resume-store migration defaults, then run focused tests plus typecheck/build.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added shared resume-generation types, structured Build handoff payloads, pipeline resumeGeneration metadata, and resume workspace generation state. Preserved backward compatibility for legacy jd/vectorId launches and legacy pipeline resumeVariant/vectorId/presetId data through normalization and migration helpers. Verification: npm run typecheck; npx vitest run src/test/resumeGeneration.test.ts src/test/handoffStore.test.ts src/test/pipelineStore.test.ts src/test/resumeStore.test.ts src/test/researchUtils.test.ts src/test/PipelinePage.test.tsx src/test/BuildPage.test.tsx; npx eslint src/utils/resumeGeneration.ts src/store/handoffStore.ts src/store/pipelineStore.ts src/routes/build/BuildPage.tsx src/routes/pipeline/PipelinePage.tsx src/test/resumeGeneration.test.ts src/test/BuildPage.test.tsx src/test/handoffStore.test.ts src/test/pipelineStore.test.ts src/test/resumeStore.test.ts; npm run build. Review artifacts: .agents/reviews/review-20260418-072632.md and .agents/reviews/test-audit-20260418-073750.md.
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
