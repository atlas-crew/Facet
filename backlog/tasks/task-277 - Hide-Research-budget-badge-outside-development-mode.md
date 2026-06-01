---
id: TASK-277
title: Hide Research budget badge outside development mode
status: To Do
assignee: []
created_date: '2026-06-01 19:06'
labels:
  - bug
  - research
dependencies: []
references:
  - TODO.md
  - src/routes/research/ResearchPage.tsx
  - src/routes/research/research.css
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
- [ ] #1 The Research header budget badge renders in development mode only.
- [ ] #2 Production/non-dev UI does not show budget labels, remaining budget, or loading budget chrome in the header.
- [ ] #3 Budget enforcement, budget exceeded errors, and existing launch guardrails continue to work when the badge is hidden.
- [ ] #4 Focused tests cover dev and non-dev rendering of the budget badge.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Regression tests pass (scoped to touched files)
- [ ] #5 Linters report no warnings or errors in touched files
- [ ] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
