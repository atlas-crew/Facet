---
id: TASK-162
title: Add SSE subscription endpoint for research job streaming
status: To Do
assignee: []
created_date: '2026-04-19 09:00'
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
- [ ] #1 GET /research/jobs/:id/stream endpoint accepts SSE connections
- [ ] #2 Auth-scoped: only job owner can subscribe
- [ ] #3 Keep-alive comments sent at ~15s intervals
- [ ] #4 Event types status, thinking, search_query, finding, progress, error, complete are all emitted per the spec
- [ ] #5 Late-joining subscribers immediately receive complete event if job is done
- [ ] #6 Multiple simultaneous subscribers receive the same event stream
- [ ] #7 Subscription closes cleanly when job reaches terminal state or client disconnects
- [ ] #8 When SSE is not configured, endpoint returns 501 Not Implemented (not 500)
- [ ] #9 Integration test: subscribe to a mock running job and verify event ordering
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
