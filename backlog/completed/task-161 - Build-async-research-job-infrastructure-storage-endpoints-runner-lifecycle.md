---
id: TASK-161
title: 'Build async research job infrastructure: storage, endpoints, runner lifecycle'
status: Done
assignee:
  - '@codex'
created_date: '2026-04-19 09:00'
updated_date: '2026-04-25 00:11'
labels:
  - search-redesign
  - proxy
  - infrastructure
milestone: m-21
dependencies:
  - TASK-153
  - TASK-160
references:
  - src/utils/searchExecutor.ts
  - src/utils/llmProxy.ts
documentation:
  - 'backlog doc-24: Phase 2 Deep Research Execution section'
  - 'backlog doc-24: Proxy Changes Required, Async Job Infrastructure subsection'
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the server-side async job infrastructure that runs Phase 2 deep research calls. The client does NOT hold a 10-20 minute HTTP connection — it posts a job, gets a `jobId`, and polls or subscribes for status. This is the single most important operational change in the search redesign.

**Why async:** a single long-held HTTP request dies on tab close, page reload, network switch, OS-level tab suspension, and any intermediate load balancer or CDN idle timeout. For a 10-20 minute Task Budgets call at $5-15 per invocation, losing the result to a dropped connection is unacceptable. Async-job makes the run survive all of those.

**Durable job storage:**
- Per-user `ResearchJob` records (type from TASK-160)
- Storage backend appropriate to the proxy runtime (Cloudflare Durable Object per job OR D1 row OR KV+Queue; pick what fits facetServer's stack)
- TTL cleanup for completed/failed jobs after N days (configurable; default 30)
- Cross-user auth isolation enforced on every read

**Endpoints:**

1. `POST /research/jobs` — create a job
   - Body: `{ thesisSnapshot, thesisId, identityVersion, params }`
   - Validate: thesis has narrative, identity evidence is present
   - Create ResearchJob in `queued` state, enqueue runner, return `{ jobId, status: 'queued' }` immediately
   - Cost guardrail check (see TASK-164): reject if user is over budget ceiling
   - Double-submit guard: if a running job exists with matching `thesisId + paramsHash + userId`, return that existing `jobId` instead

2. `GET /research/jobs/:id` — status + result
   - Auth-scoped to job owner
   - Returns the full `ResearchJob` record
   - Cache headers indicate freshness expectations for polling clients

3. `POST /research/jobs/:id/cancel` — cancellation
   - Auth-scoped to job owner
   - Marks job `canceled`, runner observes and aborts upstream Anthropic call
   - Races: if job completes between cancel-request and observe, cancellation is no-op

4. `GET /research/jobs` — list user's recent jobs (for a "my searches" view)
   - Pagination by `createdAt desc`
   - Auth-scoped

**Runner lifecycle:**
- Runner picks up queued jobs, transitions to `running`, records `startedAt`
- Builds the Anthropic request using TASK-153's pass-through parameters
- Calls Anthropic with the thesis + identity evidence prompt (prompt contract lives in TASK-151.2)
- Writes `progress` updates on a cadence (every ~15-30s or on notable events)
- On completion: validates reasoning contract (executive summary, candidate edge length); writes `result`, transitions to `completed`, records `completedAt`, records `tokenUsage`
- On upstream error: classifies as retriable/fatal; retries transient errors up to N times; on fatal error captures code/message and transitions to `failed`
- Heartbeat: runner writes a last-seen timestamp; orphaned jobs (no heartbeat for >M seconds) are marked `failed` by a sweeper

**Observability:**
- Every job transition logs with jobId, userId, status, tokenUsage, error
- Metrics: job duration, job cost, upstream error rate

**Out of scope (see sibling tasks):**
- SSE subscription endpoint → TASK-162
- Cost guardrails (preview, budget ceiling) → TASK-164
- Client-side polling loop → TASK-151.2
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 POST /research/jobs validates thesis, creates durable job record, enqueues runner, returns jobId immediately
- [x] #2 GET /research/jobs/:id returns full ResearchJob record, auth-scoped to owner
- [x] #3 POST /research/jobs/:id/cancel transitions job to canceled and aborts upstream
- [x] #4 GET /research/jobs lists user's recent jobs with pagination
- [x] #5 Runner executes Anthropic Task Budgets call with correct parameters (from TASK-153 passthrough)
- [x] #6 Runner writes periodic progress updates (phase, searchQueries, elapsedMs)
- [x] #7 Runner validates reasoning output contract on completion; flags violations on result record
- [x] #8 Double-submit guard returns existing jobId for duplicate (thesisId + paramsHash + userId)
- [x] #9 Retriable upstream errors are retried up to N times; fatal errors captured with code/message
- [x] #10 Heartbeat mechanism detects and fails orphaned jobs
- [x] #11 TTL cleanup removes completed/failed jobs after configured window
- [x] #12 Cross-user isolation verified: user A cannot read/cancel user B's jobs
- [x] #13 Observability: every transition logged with jobId, userId, status, tokenUsage
- [x] #14 Integration test: full happy-path (create → running → completed → fetch result) with mock Anthropic responses
- [x] #15 Integration test: cancel-mid-run path correctly aborts and preserves thesis
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented async research job infrastructure: file/in-memory job stores, /research/jobs endpoints, auth-scoped reads/cancel/list, duplicate-submit guard, hosted rate limiting, Anthropic Task Budgets runner, progress/heartbeat/orphan cleanup, retries/backoff, result contract validation, and transition observability. Added integration and store tests for happy path, cancellation, isolation, validation, persistence, shutdown abort, cache headers, heartbeat, parser edge cases, and failure paths.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented TASK-161 async deep-research job infrastructure. Verification: npx vitest run src/test/researchJobs.test.ts src/test/facetServer.test.ts passed (59 tests); npm run typecheck passed; focused eslint on touched files passed; npm run build passed; npm run test passed (128 files, 1479 tests). Independent review artifact: .agents/reviews/review-20260424-195958.md; final test audit artifact: .agents/reviews/test-audit-20260424-200740.md.
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
