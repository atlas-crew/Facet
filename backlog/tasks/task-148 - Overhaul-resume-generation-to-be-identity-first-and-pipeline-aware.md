---
id: TASK-148
title: Overhaul resume generation to be identity-first and pipeline-aware
status: Done
assignee:
  - Codex
created_date: '2026-04-18 10:59'
updated_date: '2026-04-18 18:07'
labels:
  - resume
  - build
  - identity
  - pipeline
  - ai
milestone: m-19
dependencies: []
references:
  - src/routes/build/BuildPage.tsx
  - src/store/resumeStore.ts
  - src/store/handoffStore.ts
  - src/routes/pipeline/PipelinePage.tsx
  - src/routes/pipeline/PipelineEntryModal.tsx
  - src/identity/resumeAdapter.ts
  - src/identity/schema.ts
  - src/utils/jdAnalyzer.ts
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Redesign the Build workspace so resume generation is downstream of the Professional Identity model and pipeline job context instead of being primarily driven by hand-edited ResumeData. The new system should support three explicit resume modes: single vector, multi-vector (auto or manual), and dynamic per-job generation. AI should suggest resume vectors before downstream assembly guidance is applied.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Build supports explicit resume generation modes for single, multi-vector, and dynamic per-job workflows.
- [x] #2 Resume generation derives from the current Professional Identity model rather than relying on the synthetic identity-default import path as the primary authoring flow.
- [x] #3 Pipeline job context can drive a per-job resume generation workflow with structured variant metadata instead of a free-text resumeVariant field.
- [x] #4 AI vector suggestion happens before downstream assembly guidance for resume generation flows that use AI.
- [x] #5 The implementation is split into reviewable subtasks that include required tests and documentation updates in the same task tree.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Land TASK-148.1 first: add shared resume-generation types, structured handoff payloads, pipeline metadata, and backward-compatible store migrations.
2. Use TASK-148.1 as the compatibility seam for later subtasks so Build can move from resume-store-first behavior to identity-first generation without another migration pass.
3. Sequence the remaining subtasks as: identity-derived workspace generation (TASK-148.2), AI vector suggestion (TASK-148.3), dynamic pipeline generation (TASK-148.4), then UI/docs polish (TASK-148.5).
4. Keep each subtask as an atomic agent-loop with focused tests, build/typecheck receipts, and no silent scope expansion.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-04-18: TASK-148.1 completed. Foundation now includes explicit resume-generation modes, structured Build handoff payloads, pipeline resumeGeneration metadata, and resume workspace generation state with backward-compatible normalization and migration coverage.
2026-04-18: TASK-148.2 completed. Professional Identity imports now derive real resume vectors, generation metadata, and vector-aware target lines/profiles/skills/roles/projects from identity search_vectors, with fallback handling only when identity vectors are missing.

2026-04-18: Completed TASK-148.3. Build now gates JD assembly suggestions behind an explicit AI-first vector planning step with single and multi-vector flows, AI-suggested vs manual selection, and focused Build/JD parser tests. Receipts: .agents/reviews/review-20260418-083814.md and .agents/reviews/test-audit-20260418-084053.md.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed the Resume Generation V2 parent after completing TASK-148.1 through TASK-148.5.
Delivered identity-first resume generation foundations, identity-derived workspace generation, AI-first vector planning for single and multi-vector flows, dynamic per-job generation from pipeline entries, and Build UI/docs updates for the new resume model.
Subtask receipts:
- TASK-148.1 foundation and migrations landed
- TASK-148.2 identity-derived resume workspace generation landed
- TASK-148.3 AI-first vector suggestion flow landed
- TASK-148.4 dynamic pipeline generation landed
- TASK-148.5 Build UI/docs guidance landed
Parent closure basis: all subtasks are Done, with focused tests, lint/typecheck/build receipts recorded on the subtask records.
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
