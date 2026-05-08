---
id: TASK-61
title: Implement Deep Job Research feature
status: Done
assignee:
  - codex
created_date: '2026-03-10 22:26'
updated_date: '2026-03-11 04:03'
labels:
  - feature
  - ai
  - search
milestone: m-4
dependencies: []
references:
  - src/store/pipelineStore.ts
  - src/utils/prepGenerator.ts
  - src/utils/jdAnalyzer.ts
  - src/routes/letters/LettersPage.tsx
  - src/routes/pipeline/pipeline.css
  - src/components/AppShell.tsx
  - src/router.tsx
  - proxy/server.js
  - src/utils/idUtils.ts
  - src/types.ts
  - .agents/reviews/review-20260310-235018.md
  - .agents/reviews/test-audit-20260310-235950.md
  - .agents/reviews/test-audit-20260310-235952.md
documentation:
  - 'backlog://document/doc-4'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
AI-powered job search feature: infer a search profile from resume data, refine constraints/preferences, run web searches via Claude API to find tiered job matches (1-5 Tier 1, 5-15 Tier 2/3), and push results into Pipeline store.

See backlog document `doc-4` for the full implementation plan with type definitions, function signatures, sequencing, patterns, and test cases.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Types defined in src/types/search.ts (SearchProfile, SearchRequest, SearchRun, SearchResultEntry, SkillCatalogEntry)
- [x] #2 Zustand store in src/store/searchStore.ts with profile/request/run CRUD, persisted as facet-search-data
- [x] #3 Proxy server passes tools array through to Anthropic API
- [x] #4 Profile inference utility infers skills/vectors/workSummary from ResumeData via AI
- [x] #5 Search executor runs web_search tool via proxy, returns tiered results
- [x] #6 ResearchPage with three tabs: Profile Editor, Search Launcher, Results Viewer
- [x] #7 Route registered at /research with nav item in AppShell sidebar
- [x] #8 Results can be pushed to Pipeline store as PipelineEntry
- [x] #9 Store and normalizer unit tests pass
- [x] #10 npm run typecheck and npm run test pass clean
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add search domain types and a persisted Zustand store for profile/request/run state.
2. Extend the proxy and add AI utilities for profile inference and web-backed search execution.
3. Build the /research route, styles, routing/nav integration, and pipeline push actions.
4. Add unit tests for the store and inference normalization, then run typecheck/test/build verification.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verification: `npm run typecheck` passed, `npm run test` passed with 52 files / 411 tests, `npm run build` passed, and targeted eslint passed on touched research/search files.

Follow-up tasks created from remaining audit/review gaps: TASK-62 (ResearchPage form/state coverage), TASK-63 (researchUtils edge-case coverage), TASK-64 (ResearchPage decomposition).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the Deep Job Research feature end-to-end: added search domain types/store, AI profile inference and web-search execution utilities, the /research route and navigation, pipeline push integration, proxy tool passthrough/auth hardening, docs updates, and regression coverage. Verified with `npm run typecheck`, `npm run test`, `npm run build`, and targeted eslint on touched files. Filed TASK-62, TASK-63, and TASK-64 for remaining non-blocking review/audit follow-up work.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Documentation has been created/modified/removed as needed.
- [ ] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [ ] #4 Test changes were approved by a test gap analysis review
- [x] #5 Changes to integration points are covered by tests
- [x] #6 All tests pass successfully
- [ ] #7 Automatic formatting was applied.
- [ ] #8 Linters report no WARNINGS or ERRORS
- [x] #9 The project builds successfully
<!-- DOD:END -->
