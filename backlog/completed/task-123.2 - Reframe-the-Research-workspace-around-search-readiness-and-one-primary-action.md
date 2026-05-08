---
id: TASK-123.2
title: Reframe the Research workspace around search readiness and one primary action
status: Done
assignee:
  - codex
created_date: '2026-04-14 12:41'
updated_date: '2026-04-14 14:10'
labels:
  - ux
  - research
  - workspace-shell
dependencies: []
references:
  - src/routes/research/ResearchPage.tsx
  - src/routes/research/research.css
parent_task_id: TASK-123
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Redesign the Research workspace shell so users immediately understand the source of the search profile, the state of search readiness, and the next recommended action. The workspace should feel like a guided search surface rather than three equal peer modes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Research workspace header clearly states the workspace purpose, current profile source or readiness, and one dominant primary action.
- [x] #2 The page structure makes search the primary workflow while still supporting profile review and results inspection.
- [x] #3 Fallback or stale-profile states are explained clearly without overwhelming the main search flow.
- [x] #4 Secondary actions are visually demoted so they do not compete with the main search launch action.
- [x] #5 Relevant tests and copy are updated, and the slice verifies with typecheck, targeted tests, and build.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Review the current Research page shell, tab structure, and existing route tests to identify where search readiness, primary actions, and fallback messaging are currently expressed.
Refactor the Research page header and surrounding shell so the workspace purpose, current profile source/readiness, and one dominant Run Search action are obvious while profile review and results remain accessible.
Demote secondary actions and tighten fallback/stale-profile messaging so non-primary states support search rather than competing with it.
Update focused Research tests and any affected copy assertions to match the new shell behavior.
Verify the slice with npm run typecheck, targeted vitest for Research, targeted eslint on touched files, and npm run build before committing with cortex git commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Completed the Research shell refactor by centering the workspace around a Search Readiness card, a stateful primary header CTA, and clearer fallback messaging. Updated the route shell and focused route tests without changing the underlying search execution flow.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Refactored Research into a clearer search-first workspace: added a readiness card that explains profile source/freshness, promoted one dominant primary action in the header, demoted profile review/refresh actions, and aligned route tests with the new shell. Verified with npm run typecheck, npx vitest run src/test/ResearchPage.test.tsx, targeted eslint on touched files, and npm run build. Review artifact: .agents/reviews/review-20260414-100629.md. The later audit rerun provider fallback returned the wrong module, so the earlier Research-specific audit artifact remained the relevant coverage reference: .agents/reviews/test-audit-20260414-095623.md.
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
