---
id: TASK-148.4
title: Wire dynamic per-job resume generation from pipeline entries
status: To Do
assignee: []
created_date: '2026-04-18 11:00'
updated_date: '2026-04-18 11:00'
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
- [ ] #1 Pipeline entries can launch Build in a dynamic per-job generation mode using structured handoff state.
- [ ] #2 Dynamic mode uses the pipeline job description and available entry context to generate a job-specific resume variant.
- [ ] #3 Generated job variants are stored with structured metadata that can be referenced from the originating pipeline entry.
- [ ] #4 Pipeline UI reflects the structured generated variant state instead of only a free-text resumeVariant field.
- [ ] #5 Targeted tests cover pipeline handoff, dynamic mode initialization, and structured variant persistence.
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
