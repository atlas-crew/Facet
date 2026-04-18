---
id: TASK-120
title: Reuse and extend job research inside the pipeline
status: In Progress
assignee: []
created_date: '2026-04-14 09:35'
labels:
  - pipeline
  - research
  - ai
dependencies: []
references:
  - src/routes/research/ResearchPage.tsx
  - src/routes/research/researchUtils.ts
  - src/routes/pipeline/PipelinePage.tsx
  - src/routes/pipeline/PipelineDetail.tsx
  - src/store/pipelineStore.ts
  - src/utils/searchExecutor.ts
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make pipeline jobs carry forward available research context from the Research flow and allow users to trigger deeper AI investigation from inside the pipeline so job descriptions, interview signals, and relevant people research are easier to collect without leaving the workflow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Pipeline entries can persist optional structured research data without breaking existing saved data or imports.
- [ ] #2 Jobs pushed from Research into Pipeline carry forward available research context instead of starting from an empty research state.
- [ ] #3 Pipeline users can trigger AI investigation from a pipeline job and have the entry updated with richer job research such as job description context, interview signals, and people research when public evidence is available.
- [ ] #4 Pipeline UI clearly surfaces reused and newly gathered research details, including source links or provenance where available.
- [ ] #5 Relevant typecheck, vitest, eslint, and build verification pass for the changed pipeline and research slices.
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
