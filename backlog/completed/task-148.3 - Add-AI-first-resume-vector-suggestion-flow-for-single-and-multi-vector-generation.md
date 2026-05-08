---
id: TASK-148.3
title: >-
  Add AI-first resume vector suggestion flow for single and multi-vector
  generation
status: Done
assignee: []
created_date: '2026-04-18 11:00'
updated_date: '2026-04-18 12:45'
labels:
  - resume
  - build
  - ai
  - identity
milestone: m-19
dependencies:
  - TASK-148.1
  - TASK-148.2
references:
  - src/utils/jdAnalyzer.ts
  - src/routes/build/BuildPage.tsx
  - src/store/resumeStore.ts
  - src/identity/schema.ts
parent_task_id: TASK-148
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Introduce an AI step that suggests resume vectors before downstream assembly guidance is applied. This should support both a single recommended vector flow and a multi-vector flow where vectors can be AI-suggested automatically or selected manually by the user.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 AI-enabled resume generation can return suggested resume vectors before bullet or component-level assembly guidance is applied.
- [x] #2 Build exposes a single-vector flow that can accept one suggested vector and continue into assembly.
- [x] #3 Build exposes a multi-vector flow that supports AI-suggested vectors and manual vector selection.
- [x] #4 The vector suggestion step is clearly separated from downstream JD or assembly guidance in state and UI flow.
- [x] #5 Targeted tests cover vector suggestion parsing, state transitions, and manual-vs-auto mode behavior.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added AI-first resume vector planning ahead of JD assembly suggestions. Build now pauses after JD analysis so users can review a single- or multi-vector plan, switch between AI-suggested and manual selection, and continue into suggestion mode only after confirming the plan. Tightened parser validation for suggested_vectors, preserved true AI suggestions separately from fallback selection, and hardened manual multi-vector behavior so the last vector cannot be silently removed. Verification: npx vitest run src/test/jdAnalyzer.test.ts src/test/resumeVectorPlan.test.ts src/test/BuildPage.test.tsx (21 passed); npx eslint src/utils/jdAnalyzer.ts src/utils/resumeVectorPlan.ts src/routes/build/BuildPage.tsx src/test/jdAnalyzer.test.ts src/test/resumeVectorPlan.test.ts src/test/BuildPage.test.tsx; npm run typecheck; npm run build. Independent review: .agents/reviews/review-20260418-083814.md (PASS WITH ISSUES, no P0/P1). Test audit: .agents/reviews/test-audit-20260418-084053.md remained broad and mostly reported long-standing BuildPage surface-area gaps rather than regressions in this slice.
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
