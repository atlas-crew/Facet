---
id: TASK-72
title: Stabilize aggregate Vitest timeouts for ThemeEditorPanel and ResearchPage
status: Done
assignee:
  - Codex
created_date: '2026-03-12 05:16'
updated_date: '2026-03-12 08:57'
labels:
  - testing
  - stability
  - remediation
milestone: m-11
dependencies: []
references:
  - src/test/ThemeEditorPanel.test.tsx
  - src/test/ResearchPage.test.tsx
  - .agents/reviews/review-20260312-045511.md
  - .agents/reviews/test-audit-20260312-045127.md
  - .agents/reviews/test-audit-20260312-045511.md
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`npm run test` intermittently times out in aggregate on `src/test/ThemeEditorPanel.test.tsx` and `src/test/ResearchPage.test.tsx` even though both files pass in isolation. Capture and fix the suite-level contention or timing assumptions so full-repo verification is trustworthy again.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `npm run test` passes without timing out in aggregate for `ThemeEditorPanel.test.tsx` and `ResearchPage.test.tsx`.
- [x] #2 The root cause of the aggregate-only timeout behavior is identified and either fixed or explicitly documented with a bounded workaround.
- [x] #3 Focused regression coverage or test harness adjustments prevent the timeout from silently recurring.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-03-12: Starting TASK-72 to stabilize the aggregate-only Vitest timeouts affecting ThemeEditorPanel and ResearchPage. The first step is to reproduce the full-suite failure path, compare it with isolated runs, and identify whether the cause is shared global state, worker contention, or overly strict test timing assumptions.

2026-03-12: Reproduced the prior aggregate-only timeout symptom and confirmed it was not a product regression in either surface. Both tests passed in isolation, which pointed to suite-level JSDOM contention and brittle test timing rather than broken ThemeEditorPanel or ResearchPage behavior.

2026-03-12: Stabilized `ThemeEditorPanel.test.tsx` by scoping the density-button role queries with `within(screen.getByLabelText('Spacing density controls'))` instead of scanning the full document, while keeping the role-based assertion path intact.

2026-03-12: Stabilized `ResearchPage.test.tsx` by keeping the load-bearing `waitFor` after the Add to Pipeline click, asserting the store length and navigation together before reading the inserted entry, and removing the optional-chaining assertions that weakened the failure signal.

2026-03-12: Kept explicit test ceilings bounded at 10s rather than stretching them further; after the query/wait cleanup both the focused pair and the full `npm run test` suite passed consistently again.

2026-03-12 verification: `npx vitest run src/test/ThemeEditorPanel.test.tsx src/test/ResearchPage.test.tsx`; `npx eslint src/test/ThemeEditorPanel.test.tsx src/test/ResearchPage.test.tsx`; `npm run typecheck`; `npm run test`; `npm run build` all passed.

2026-03-12 review/audit: `review-20260312-045511.md` returned PASS WITH ISSUES with only P2 testing nits left. Quick audit artifacts were noisier than ideal because one overlapping quick-run filename was reused, but the usable reports did not surface any remaining P0/P1 timeout-stability issues after remediation.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Stabilized the aggregate-only Vitest timeout drift for ThemeEditorPanel and ResearchPage by tightening the slow test paths instead of inflating timeouts. The final change keeps ResearchPage's async wait contract intact, removes the weak optional-chaining assertions, scopes ThemeEditorPanel's role queries to the density-controls container, and preserves a bounded 10s ceiling. Focused test runs, lint, typecheck, the full `npm run test` suite, build, and final independent review all passed.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [ ] #2 Documentation has been created/modified/removed as needed.
- [ ] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [x] #4 Test changes were approved by a test gap analysis review
- [x] #5 Changes to integration points are covered by tests
- [x] #6 All tests pass successfully
- [ ] #7 Automatic formatting was applied.
- [x] #8 Linters report no WARNINGS or ERRORS
- [x] #9 The project builds successfully
<!-- DOD:END -->
