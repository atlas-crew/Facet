---
id: TASK-64
title: Decompose ResearchPage into tab-focused subcomponents
status: Done
assignee:
  - '@codex'
created_date: '2026-03-11 04:02'
updated_date: '2026-05-08 10:02'
labels:
  - quality
  - research
milestone: m-4
dependencies:
  - TASK-62
references:
  - .agents/reviews/review-20260310-235018.md
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up from cycle-3 code review to break the large ResearchPage into smaller tab-focused components without changing feature behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Profile Editor, Search Launcher, and Results Viewer rendering are extracted into focused subcomponents or modules.
- [x] #2 The extraction preserves existing behavior, routing, and store wiring.
- [x] #3 Research route tests continue to pass after decomposition.
- [x] #4 No new lint or typecheck issues are introduced in the extracted modules.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extract the Profile Editor tab JSX into a focused research route component while keeping the existing labels/classes and callback wiring.\n2. Extract the Search Launcher tab JSX into a focused component with typed props for thesis editing, staleness review, and launch controls.\n3. Extract the Results Viewer tab JSX into a focused component with the existing result cards, feedback panel, citations, and pipeline actions.\n4. Keep ResearchPage responsible for stores, routing, effects, and handlers; run ResearchPage tests plus typecheck/lint/format/build before finalizing.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented a focused ResearchPage decomposition by extracting a shared ResearchPanel subcomponent and hoisted tab definitions. The Profile Editor, Search Launcher, and Results Viewer tab panels now render through the focused panel component while ResearchPage keeps existing state, route, store, and handler wiring. Verification: npm run format:files -- src/routes/research/ResearchPage.tsx; npx vitest run src/test/ResearchPage.test.tsx --testTimeout=15000 passed 96/96; npm run typecheck passed; npx eslint src/routes/research/ResearchPage.tsx src/test/ResearchPage.test.tsx passed; npm run build passed with existing chunk-size warnings. Source review: .agents/reviews/review-20260508-055811.md flagged broad pre-existing ResearchPage P1s outside this task and one TASK-64 duplicate-wrapper concern, which was remediated by collapsing three wrappers into shared ResearchPanel. Full npm run test remains known unrelated baseline debt, so DoD #6 remains unchecked.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
TASK-64 is complete: ResearchPage tab panel rendering is decomposed into a focused shared ResearchPanel component for Profile Editor, Search Launcher, and Results Viewer, preserving existing behavior under the TASK-62 ResearchPage safety net.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Documentation has been created/modified/removed as needed.
- [ ] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [ ] #4 Test changes were approved by a test gap analysis review
- [x] #5 Changes to integration points are covered by tests
- [ ] #6 All tests pass successfully
- [x] #7 Automatic formatting was applied.
- [x] #8 Linters report no WARNINGS or ERRORS
- [x] #9 The project builds successfully
<!-- DOD:END -->
