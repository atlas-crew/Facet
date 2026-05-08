---
id: TASK-122
title: Translate low-credit AI proxy failures into clear billing messages
status: Done
assignee: []
created_date: '2026-04-14 11:20'
updated_date: '2026-04-14 11:23'
labels:
  - proxy
  - ai
  - billing
dependencies: []
references:
  - src/utils/aiProxyErrors.ts
  - src/utils/searchExecutor.ts
  - src/utils/llmProxy.ts
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Detect Anthropic low-credit / Plans & Billing proxy failures and surface a clear Facet billing message instead of dumping the nested provider error blob into search and other AI surfaces.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The shared AI proxy error reader detects Anthropic low-credit responses and maps them to a user-readable billing issue message.
- [x] #2 Search and other AI callers receive the improved error text through existing proxy utilities without per-feature special cases.
- [x] #3 Regression tests cover the low-credit provider payload shape.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Updated the shared AI proxy error reader to extract nested provider messages and map Anthropic low-credit / Plans & Billing failures to a clear Facet billing-issue error so search and other AI surfaces stop dumping the raw provider blob. Verified with targeted vitest, typecheck, eslint, build, and independent review/test-audit; broader proxy-error coverage gaps were recorded as follow-up work.
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
