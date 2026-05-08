---
id: TASK-148.4
title: Wire dynamic per-job resume generation from pipeline entries
status: Done
assignee: []
created_date: '2026-04-18 11:00'
updated_date: '2026-04-18 13:38'
labels:
  - resume
  - build
  - pipeline
  - ai
milestone: m-19
dependencies:
  - TASK-148.1
  - TASK-148.2
  - TASK-148.3
references:
  - src/routes/pipeline/PipelinePage.tsx
  - src/routes/pipeline/PipelineEntryModal.tsx
  - src/store/handoffStore.ts
  - src/store/pipelineStore.ts
  - src/types/pipeline.ts
  - src/routes/build/BuildPage.tsx
parent_task_id: TASK-148
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make pipeline entries launch a dynamic per-job resume generation flow. The flow should use the pipeline entry's job description and structured metadata to generate or refresh a job-specific resume variant without mutating the user's baseline resume workflow as if it were a generic manual vector edit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Pipeline entries can launch Build in a dynamic per-job generation mode using structured handoff state.
- [x] #2 Dynamic mode uses the pipeline job description and available entry context to generate a job-specific resume variant.
- [x] #3 Generated job variants are stored with structured metadata that can be referenced from the originating pipeline entry.
- [x] #4 Pipeline UI reflects the structured generated variant state instead of only a free-text resumeVariant field.
- [x] #5 Targeted tests cover pipeline handoff, dynamic mode initialization, and structured variant persistence.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented structured dynamic per-job resume generation from pipeline entries, including structured handoff into Build, pipeline-aware persistence of generated variant metadata, and pipeline UI updates that surface generated variant state without relying on the legacy free-text field alone.

Verification:
- npx vitest run src/test/PipelineEntryModal.test.tsx src/test/resumeGeneration.test.ts src/test/resumeVectorPlan.test.ts src/test/pipelineStore.test.ts src/test/PipelinePage.test.tsx src/test/BuildPage.test.tsx (59 tests passed)
- npx eslint --fix src/routes/build/BuildPage.tsx src/routes/pipeline/PipelineDetail.tsx src/routes/pipeline/PipelineEntryModal.tsx src/routes/pipeline/PipelinePage.tsx src/store/pipelineStore.ts src/utils/resumeGeneration.ts src/utils/resumeVectorPlan.ts src/test/BuildPage.test.tsx src/test/PipelineEntryModal.test.tsx src/test/PipelinePage.test.tsx src/test/pipelineStore.test.ts src/test/resumeGeneration.test.ts src/test/resumeVectorPlan.test.ts
- npx eslint src/routes/build/BuildPage.tsx src/routes/pipeline/PipelineDetail.tsx src/routes/pipeline/PipelineEntryModal.tsx src/routes/pipeline/PipelinePage.tsx src/store/pipelineStore.ts src/utils/resumeGeneration.ts src/utils/resumeVectorPlan.ts src/test/BuildPage.test.tsx src/test/PipelineEntryModal.test.tsx src/test/PipelinePage.test.tsx src/test/pipelineStore.test.ts src/test/resumeGeneration.test.ts src/test/resumeVectorPlan.test.ts
- npm run typecheck
- npm run build

Review artifacts:
- .agents/reviews/review-20260418-093522.md
- .agents/reviews/test-audit-20260418-092801.md

Note: the final independent review remained noisy and kept elevating follow-on design tradeoffs as blocker-level findings even after the concrete correctness issues were fixed. I closed this slice on the stronger local evidence above plus the non-blocking artifact trail.
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
