---
id: TASK-162
title: Add SSE subscription endpoint for research job streaming
status: Done
assignee:
  - '@lane-d-worker'
created_date: '2026-04-19 09:00'
updated_date: '2026-05-07 22:11'
labels:
  - search-redesign
  - proxy
  - infrastructure
  - enhancement
milestone: m-21
dependencies:
  - TASK-161
references:
  - src/utils/searchExecutor.ts
documentation:
  - 'backlog doc-24: Client SSE Subscription subsection'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add `GET /research/jobs/:id/stream` — an SSE (Server-Sent Events) endpoint that subscribes to a running research job and emits progress events. This is a **view into the job**, not the transport for the result. The result always lands in durable storage (TASK-161); SSE is purely for shepherding UX while the user is watching.

**Why this is a separate task from TASK-161:**
- Async job infra is required for correctness
- SSE is a quality-of-experience enhancement for the shepherding UX
- Degrading to polling-only should work without user-visible breakage
- Decoupling lets TASK-161 ship independently; TASK-162 layers on top

**Endpoint behavior:**
- `GET /research/jobs/:id/stream` — auth-scoped to job owner
- Content-Type: `text/event-stream`
- Keep-alive comments every ~15s to prevent idle timeouts on intermediate proxies
- Emits events as the runner produces them:

```
event: status
data: {"status":"running","phase":"analyzing thesis"}

event: thinking
data: {"text":"Looking at the Platform + Security + Fleet Management combination..."}

event: search_query
data: {"query":"\"platform engineer\" security startup"}

event: finding
data: {"summary":"Found 3 promising companies in early-stage security platform space"}

event: status
data: {"status":"completed","jobId":"abc123"}
```

**Event types:**
- `status` — lifecycle transitions
- `thinking` — extended-thinking text chunks (passthrough from Anthropic)
- `search_query` — web searches as they execute
- `finding` — intermediate finding summaries
- `progress` — phase name and elapsedMs updates
- `error` — terminal error events
- `complete` — final signal that result is ready (client fetches via GET /research/jobs/:id)

**Implementation details:**
- If the runtime supports direct SSE passthrough from Anthropic (Cloudflare Workers, Node streams), pipe runner events through to the client
- If not, the runner writes events to a pub/sub channel keyed by jobId; the SSE endpoint subscribes and forwards
- Multiple clients can subscribe to the same jobId (multi-device observation)
- If subscriber connects after job is completed, server immediately emits the `complete` event and closes

**Graceful degradation:**
- If this endpoint is not deployed, client (TASK-151.2) falls back to polling-only
- Server should return 404 or 501 when SSE is not available, not 500

**Out of scope:**
- Client-side SSE consumer → TASK-151.2
- Persisting streamed events as job history → not needed (result always includes final narrative)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 GET /research/jobs/:id/stream endpoint accepts SSE connections
- [x] #2 Auth-scoped: only job owner can subscribe
- [x] #3 Keep-alive comments sent at ~15s intervals
- [x] #4 Event types status, thinking, search_query, finding, progress, error, complete are all emitted per the spec
- [x] #5 Late-joining subscribers immediately receive complete event if job is done
- [x] #6 Multiple simultaneous subscribers receive the same event stream
- [x] #7 Subscription closes cleanly when job reaches terminal state or client disconnects
- [x] #8 When SSE is not configured, endpoint returns 501 Not Implemented (not 500)
- [x] #9 Integration test: subscribe to a mock running job and verify event ordering
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Implementation plan:\n1. Extend proxy/researchJobs.js with a small in-process job event hub that can publish structured SSE events from lifecycle/progress transitions and subscribe multiple clients by job id.\n2. Add GET /research/jobs/:id/stream routing with actor-scoped lookup, text/event-stream headers, configurable keepalive comments, late-terminal complete/error behavior, and clean cleanup on client disconnect/terminal events.\n3. Cover the endpoint in src/test/researchJobs.test.ts with localhost HTTP integration tests for auth scoping, event ordering/types, keepalive, multi-subscriber fanout, late-complete close, and disabled-SSE 501 behavior.\n4. Run focused proxy tests plus typecheck/lint/build as feasible, then independent code review and diff test audit before final Backlog closeout.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lane D plan recorded before implementation. Scope is limited to proxy research job streaming and focused server tests; Lane B ResearchPage/search-profile files remain out of scope.

Implemented SSE endpoint and tests. Prettier file check remains a documented caveat because applying it rewrites existing untouched formatting; scoped lint/typecheck/build pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Summary:\n- Added GET /research/jobs/:id/stream as a proxy SSE endpoint with actor-scoped job lookup, text/event-stream headers, keepalive comments, disabled-SSE 501 handling, initial status/progress replay, multi-subscriber fanout, terminal close behavior, and late-completed complete events.\n- Published research job lifecycle/progress/error/complete events through an in-process event hub and derives available thinking/search_query/finding events from Anthropic response content/final results for the current non-streaming runner architecture.\n- Added focused localhost HTTP integration coverage for stream acceptance, CORS header preservation, auth scoping, disabled 501 behavior, keepalive, multi-subscriber ordering, late completion, failed jobs, and cancellation terminal events.\n\nValidation:\n- npx vitest run src/test/researchJobs.test.ts: PASS (23 tests)\n- npx eslint proxy/researchJobs.js proxy/facetServer.js src/test/researchJobs.test.ts: PASS\n- npm run typecheck: PASS\n- npm run build: PASS\n- npm run format:files:check -- proxy/researchJobs.js proxy/facetServer.js src/test/researchJobs.test.ts: FAIL; existing repo formatting style differs from Prettier, and running Prettier caused broad unrelated churn, so it was reverted.\n\nReview/audit:\n- Code review artifacts: .agents/reviews/review-20260507-174320.md, .agents/reviews/review-20260507-174804.md, .agents/reviews/review-20260507-175210.md, .agents/reviews/review-20260507-175655.md\n- Test audit artifact: .agents/reviews/test-audit-20260507-180406.md\n\nCaveats:\n- Current runner is still non-streaming Anthropic messages.create, so thinking/search_query/finding events are replayed when the upstream response is available rather than live token-by-token passthrough.\n- Test audit still identified deeper follow-up coverage gaps, especially revoked-auth keepalive behavior and backpressure branches; cancellation coverage was added in this slice.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
