---
id: TASK-121.2
title: Add pipeline-side AI investigation and research rendering
status: Done
assignee: []
created_date: '2026-04-14 09:36'
updated_date: '2026-04-14 10:54'
labels:
  - pipeline
  - research
  - ui
dependencies:
  - TASK-121
references:
  - src/routes/pipeline/PipelinePage.tsx
  - src/routes/pipeline/PipelineDetail.tsx
  - src/routes/pipeline/pipeline.css
  - src/utils/searchExecutor.ts
parent_task_id: TASK-121
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Let pipeline users trigger AI-powered job investigation from an entry, reuse the existing research search capability, update the entry with the returned research, and render the result clearly inside the pipeline detail view.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Pipeline detail exposes an investigate action that uses the existing research search capability and reports loading and error states clearly.
- [x] #2 Successful investigation updates the pipeline entry with richer research details such as job description context, interview signals, people research, and sources when found.
- [x] #3 Pipeline detail renders reused and generated research in a way that is readable and distinct from freeform notes.
- [x] #4 Pipeline route tests cover the new investigate interaction and rendered research details.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added pipeline-side AI investigation that reuses the search proxy, merges seeded research with newly gathered public evidence, sanitizes persisted URLs, dedupes accumulating string fields, and renders job research details plus loading/error states directly in the pipeline detail view. Verified with typecheck, targeted vitest, targeted eslint, and build; non-blocking broader PipelinePage coverage gaps were recorded in a follow-up task.
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
