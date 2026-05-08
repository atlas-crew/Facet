---
id: TASK-118
title: Clamp proxy thinking budget below max tokens for search requests
status: Done
assignee: []
created_date: '2026-04-14 08:27'
updated_date: '2026-04-14 08:49'
labels:
  - bug
  - proxy
  - research
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Search requests can fail with Anthropic 400 invalid_request_error when the request's thinking budget exceeds the proxy-resolved max_tokens.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Proxy requests with thinking enabled never send budget_tokens greater than or equal to max_tokens.
- [x] #2 Search requests that omit max_tokens still succeed when the proxy default max token ceiling is lower than the client thinking budget.
- [x] #3 Targeted proxy/search regressions cover the clamp behavior.
- [x] #4 Typecheck, targeted Vitest, targeted ESLint, and build pass for the touched files.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Clamped proxy thinking budgets so search requests never send budget_tokens greater than or equal to max_tokens, including malformed or overly large budget inputs. Added a focused regression in src/test/facetServer.test.ts covering a search-style request with thinking_budget 8000 against a 4096 max token ceiling. Verification: npx vitest run src/test/facetServer.test.ts -t "clamps thinking budget below max tokens for search requests"; npm run typecheck; npx eslint --no-warn-ignored proxy/facetServer.js src/test/facetServer.test.ts src/utils/searchExecutor.ts src/test/searchExecutor.test.ts; npm run build. Review artifacts: .agents/reviews/review-20260414-044329.md (CLEAN) and .agents/reviews/test-audit-20260414-044445.md. Committed as 6848356 fix(proxy): clamp search thinking budget.
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
