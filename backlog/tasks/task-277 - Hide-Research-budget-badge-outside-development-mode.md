---
id: TASK-277
title: Hide Research budget badge outside development mode
status: Done
assignee:
  - codex
created_date: '2026-06-01 19:06'
updated_date: '2026-06-07 21:15'
labels:
  - bug
  - research
milestone: m-36
dependencies: []
references:
  - TODO.md
  - src/routes/research/ResearchPage.tsx
  - src/routes/research/research.css
modified_files:
  - src/routes/research/ResearchPage.tsx
  - src/routes/research/researchBudgetVisibility.ts
  - src/test/ResearchPage.test.tsx
priority: medium
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TODO.md reports that /research should not expose the budget widget unless the app is running in development mode. The current Research header renders the research-budget badge unconditionally from ResearchUsageSnapshot budget state.

Placement: this is a Research workspace presentation/privacy issue. Runtime budget enforcement and budget-error handling should remain active; only the user-facing header widget should be hidden outside development unless a future product decision introduces a supported production-facing budget UI.

Scope notes:
- Gate the header budget badge with import.meta.env.DEV or an equivalent explicit dev-only flag.
- Keep budget checks, launch blocking, and researchBudgetNotice behavior intact so cost guardrails still work.
- Confirm production builds do not render the badge or budget copy while development builds still surface it for operators.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Research header budget badge renders in development mode only.
- [x] #2 Production/non-dev UI does not show budget labels, remaining budget, or loading budget chrome in the header.
- [x] #3 Budget enforcement, budget exceeded errors, and existing launch guardrails continue to work when the badge is hidden.
- [x] #4 Focused tests cover dev and non-dev rendering of the budget badge.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Gated the Research header budget badge behind a dev-only visibility helper while leaving budget fetch/enforcement and launch guardrails intact. Added focused tests for dev/non-dev visibility and preserved the launch budget status test. Verified focused Vitest, touched-file ESLint, typecheck, specialist review, and jumbo test audit.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 Automatic formatting was applied to touched files
- [x] #4 Regression tests pass (scoped to touched files)
- [x] #5 Linters report no warnings or errors in touched files
- [x] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
