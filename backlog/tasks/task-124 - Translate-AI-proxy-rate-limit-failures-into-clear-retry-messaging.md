---
id: TASK-124
title: Translate AI proxy rate-limit failures into clear retry messaging
status: Done
assignee: []
created_date: '2026-04-14 16:28'
updated_date: '2026-04-14 16:32'
labels:
  - bug
  - ai
  - prep
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Map provider 429 rate-limit errors into a friendly shared AI proxy error so interview prep and other AI surfaces do not show raw Anthropic rate-limit payloads.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Client-side AI proxy error parsing maps provider 429 rate-limit responses to a clear retry message.
- [x] #2 Rate-limit errors remain structured so callers can distinguish them from billing and overload failures.
- [x] #3 Focused regression coverage exists for the 429 rate-limit payload shape.
- [x] #4 Targeted verification passes with typecheck, focused vitest, eslint, and build.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Mapped provider 429 rate-limit payloads to a friendly retryable FacetAiProxyError, added focused regression coverage in aiProxyErrors.test.ts, and verified with npm run typecheck, focused vitest, targeted eslint, and npm run build.
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
