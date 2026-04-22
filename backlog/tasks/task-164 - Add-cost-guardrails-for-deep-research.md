---
id: TASK-164
title: Add cost guardrails for deep research (estimate, budget ceiling, double-submit guard)
status: To Do
assignee: []
created_date: '2026-04-19 09:00'
labels:
  - search-redesign
  - infrastructure
  - cost-safety
milestone: m-24
dependencies:
  - TASK-161
references:
  - src/utils/searchExecutor.ts
  - src/store/searchStore.ts
documentation:
  - 'backlog doc-24: Phase 2 Cost Guardrails subsection'
  - 'backlog doc-24: Key Risks section'
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
At $5-15 per deep search and a $149/90-day pass, a user could burn through their pass value in 10-30 runs. Cost guardrails protect both the user and the operator from runaway spend and accidental re-runs.

**Four guardrails:**

### 1. Estimated cost preview (client-side, before submission)

- Before enabling the "Run Search" button on an approved thesis, compute an estimated cost based on:
  - Base Task Budgets cost (Opus + 80K task budget)
  - Expected web search count (up to 20)
  - Extended thinking budget (15K tokens)
- Display as a range: "Typical cost: $5-15. Usage counts toward your 90-day pass."
- Does not block submission; purely informational

### 2. Per-user budget ceiling (server-side)

- Track deep-search token usage per user in a rolling window (e.g., 30 days)
- Configurable ceiling per pass tier
- `POST /research/jobs` checks current usage against ceiling:
  - Under ceiling: accept
  - Approaching (e.g., 80%): accept but return a warning payload
  - Over ceiling: reject with 402 Payment Required and a structured reason
- Client surfaces ceiling status in the research workspace ("You've used 60% of your search budget this month")

### 3. Double-submit guard (server-side)

- `POST /research/jobs` computes `paramsHash = hash(thesisId, paramsJSON, userId)`
- If a running job exists with matching hash: return that existing `jobId` instead of creating a new one
- Prevents:
  - Double-click on "Run Search"
  - Refresh-then-resubmit
  - Accidental simultaneous runs from two tabs

### 4. Token usage recording + query

- Every `ResearchJob.result.tokenUsage` is persisted (already covered in TASK-161)
- Add aggregate query: `GET /research/usage` returns `{ windowStart, windowEnd, runCount, totalTokens, estimatedCost, ceilingStatus }`
- Client renders usage summary in the research workspace sidebar or settings

**UI components:**
- Estimated cost label near the "Run Search" button
- Budget-status badge in research workspace header
- Usage history view (optionally reuses `GET /research/jobs` from TASK-161)

**Out of scope:**
- Billing or payment integration — this is budget-aware routing, not payment
- Cross-pass-tier logic — assume a single tier for MVP; configurable ceiling suffices
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Estimated cost preview displayed near Run Search button on thesis editor
- [ ] #2 Per-user rolling-window token usage tracked and queryable via GET /research/usage
- [ ] #3 Configurable budget ceiling enforced at POST /research/jobs
- [ ] #4 Over-ceiling requests rejected with 402 and structured reason; client shows clear message
- [ ] #5 Approaching-ceiling requests succeed but include a warning payload; client surfaces warning
- [ ] #6 Double-submit guard returns existing jobId when thesis+params+userId hash matches an in-flight job
- [ ] #7 Budget-status badge visible in research workspace header; updates after each completed run
- [ ] #8 Integration test: attempt to submit two identical requests within 1s; verify only one job is created
- [ ] #9 Integration test: simulate hitting ceiling; verify rejection and unambiguous error surface
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
