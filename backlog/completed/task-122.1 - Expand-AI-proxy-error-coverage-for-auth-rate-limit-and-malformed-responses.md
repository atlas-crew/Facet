---
id: TASK-122.1
title: Expand AI proxy error coverage for auth rate-limit and malformed responses
status: Done
assignee:
  - '@codex'
created_date: '2026-04-14 11:23'
updated_date: '2026-05-24 22:21'
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
- [x] #1 aiProxyErrors tests cover authentication and rate-limit provider payloads.
- [x] #2 aiProxyErrors tests cover malformed JSON or non-JSON proxy responses without crashing.
- [x] #3 aiProxyErrors tests cover empty-body or structurally incomplete error payloads.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-05-24 Codex starting TASK-122.1. Plan: inspect aiProxyErrors parsing/classification behavior and the existing tests; add targeted regression coverage for auth/rate-limit/overload provider payloads plus malformed, non-JSON, empty, and structurally incomplete responses; run focused tests, typecheck, scoped lint/format; send diff through independent code review/test audit; commit atomically with cortex git commit.

2026-05-24 closeout: hardened aiProxyErrors response handling and regression coverage. Implemented provider-auth detection for nested/root auth payloads, preserved explicit hosted auth_required payloads, guarded consumed/unreadable response bodies, and covered malformed JSON, non-JSON HTML, empty bodies, and structurally incomplete JSON. Verification: pnpm exec vitest run src/test/aiProxyErrors.test.ts (13 passed); pnpm exec eslint src/utils/aiProxyErrors.ts src/test/aiProxyErrors.test.ts; pnpm run typecheck; pnpm run format:files:check -- src/utils/aiProxyErrors.ts src/test/aiProxyErrors.test.ts; git diff --check; pnpm run test (173 files, 2516 tests passed); pnpm run build. Independent reviews clean: .agents/reviews/review-20260524-181850.md and .agents/reviews/test-audit-20260524-181850.md.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Expanded AI proxy error parsing and regression coverage around provider authentication, hosted auth-required, rate/overload/capability payloads, malformed/non-JSON responses, empty bodies, incomplete JSON, and consumed-body failures. All focused and full verification gates passed, with clean independent source review and test audit artifacts.
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
