---
id: TASK-204.3
title: Clean up Research preferences after canonical thesis signals
status: Done
assignee:
  - '@codex'
created_date: '2026-05-06 22:46'
updated_date: '2026-05-07 20:00'
labels:
  - refactor
  - search-redesign
  - lane-b
dependencies:
  - TASK-204.1
  - TASK-204.2
references:
  - src/routes/research/searchWorkspaceComponents.tsx
  - src/test/ResearchPage.test.tsx
documentation:
  - backlog doc-39
  - backlog TASK-204.1
  - backlog TASK-204.2
  - backlog TASK-204
parent_task_id: TASK-204
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update the Research workspace preference surface after TASK-204.1/TASK-204.2 remove duplicated search-stage filter arrays. SearchInstancePreferences should stop editing Prioritize/Avoid as free-text searchOverrides.filters inputs; canonical lookFor/avoid edits should route to the thesis strategy surface. Interview-stage preferences should remain visible only with copy/names that make their stage explicit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 SearchInstancePreferences no longer renders free-text Prioritize/Avoid inputs backed by searchOverrides.filters
- [x] #2 Any edit affordance for search-stage lookFor/avoid routes to the thesis strategy/Thesis Map surface instead of mutating duplicate override fields
- [x] #3 Strong fit/red flags labels or field names are clarified as interview-stage prep/process guidance
- [x] #4 Focused UI/state tests cover the removed duplicate inputs and surviving interview-stage preference behavior
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Completed TASK-204.3. SearchInstancePreferences now renders thesis look-for/avoid as read-only canonical signal readouts, removes duplicate Prioritize/Avoid override inputs, and routes look-for/avoid edit actions to the Search Thesis editor with focused tab handoff. Interview-stage copy now reads Interview prep advantages / Interview process risks while preserving searchOverrides.interviewPrefs storage.

Validation receipts: npm run typecheck; npx vitest run src/test/SearchInstancePreferences.editInIdentity.test.tsx src/test/ResearchPage.test.tsx (81 tests); npx eslint src/routes/research/ResearchPage.tsx src/routes/research/searchWorkspaceComponents.tsx src/test/SearchInstancePreferences.editInIdentity.test.tsx src/test/ResearchPage.test.tsx (0 warnings/errors). Broader ESLint command including research.css also exited 0 with the expected ignored-by-config CSS warning.

Review receipts: .agents/reviews/review-20260507-155659.md CLEAN. Test audit: .agents/reviews/test-audit-20260507-155841.md P0/P1=0, P2=2 defensive gaps.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 Automatic formatting was applied to touched files
- [x] #4 Linters report no WARNINGS or ERRORS for touched files
- [x] #5 Regression tests pass for touched files
<!-- DOD:END -->
