---
id: TASK-122.1
title: Expand AI proxy error coverage for auth rate-limit and malformed responses
status: In Progress
assignee:
  - '@codex'
created_date: '2026-04-14 11:23'
updated_date: '2026-05-24 22:10'
labels:
  - proxy
  - tests
dependencies: []
references:
  - .agents/reviews/test-audit-20260414-072101.md
  - src/utils/aiProxyErrors.ts
  - src/test/aiProxyErrors.test.ts
parent_task_id: TASK-122
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Cover the remaining non-blocking aiProxyErrors gaps from the independent audit, especially auth, rate-limit, overloaded, malformed JSON, and empty-body proxy responses.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 aiProxyErrors tests cover authentication and rate-limit provider payloads.
- [ ] #2 aiProxyErrors tests cover malformed JSON or non-JSON proxy responses without crashing.
- [ ] #3 aiProxyErrors tests cover empty-body or structurally incomplete error payloads.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-05-24 Codex starting TASK-122.1. Plan: inspect aiProxyErrors parsing/classification behavior and the existing tests; add targeted regression coverage for auth/rate-limit/overload provider payloads plus malformed, non-JSON, empty, and structurally incomplete responses; run focused tests, typecheck, scoped lint/format; send diff through independent code review/test audit; commit atomically with cortex git commit.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
