---
id: TASK-151.2
title: Build deep research execution (async job client) and progress UI
status: To Do
assignee: []
created_date: '2026-04-19 06:02'
labels:
  - search-redesign
milestone: m-24
dependencies:
  - TASK-153
  - TASK-160
  - TASK-161
references:
  - src/utils/searchExecutor.ts
  - src/routes/research/ResearchPage.tsx
  - src/store/searchStore.ts
documentation:
  - 'backlog doc-24: Phase 2 Deep Research Execution section'
  - 'backlog doc-24: Progress & Status During Phase 2'
  - 'backlog doc-24: Output Contract: Reasoning Layers'
parent_task_id: TASK-151
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Phase 2 of the search redesign. Client-side consumption of the async research-job API (implemented in TASK-161). The long-running Task Budgets call itself runs server-side inside the job runner; this task wires the client to create, poll, optionally subscribe to, and render jobs.

**Important architectural shift:** Phase 2 is NOT a single long-held HTTP request. The client posts the thesis + params, receives a `jobId` immediately, then polls (always) and optionally subscribes via SSE (when foregrounded). Tab close, reload, network switch, and multi-device use are all expected to work.

**Client-side execution module** (`src/utils/deepSearchClient.ts` or refactor `searchExecutor.ts`):
- Input: approved `SearchThesis` + `SearchRequest` + `identityVersion` snapshot
- `POST /research/jobs` → returns `{ jobId, status: 'queued' }` immediately
- Store `jobId` in `searchStore` for reload/rejoin
- Poll `GET /research/jobs/:id` with exponential backoff (2s → 5s → 15s → 30s cap)
- Pause polling when `document.visibilityState === 'hidden'`; resume on focus
- On `completed`: hydrate `ResearchJob.result` (narrative + results + tokenUsage) into `SearchRun`
- On `failed`/`canceled`: preserve thesis, surface error/retry affordance
- Rejoin on workspace mount: if `searchStore` holds an in-flight `jobId`, fetch current status and resume polling

**Optional SSE subscription** (graceful enhancement):
- When tab foregrounded and `GET /research/jobs/:id/stream` endpoint exists (TASK-162), open SSE connection
- Handle events: `thinking` (text stream), `search_query` (web searches executed), `finding` (intermediate results), `status` (lifecycle), `complete` (fetch result via GET)
- Close SSE when tab hidden; degrade to polling only

**Deep research prompt contract (runner-side, coordinated with TASK-161):**
- The runner is what makes the actual Anthropic call; this task is the client. But this task owns the *prompt* sent to the runner at job creation time.
- Prompt must be thesis-driven *and* carry identity evidence: `{ thesis, identityEvidence: { archetype, arc, profiles, paioHighlights, calibrations } }`. Don't ship the thesis alone — it's a compressed summary; Phase 2 needs raw PAIO evidence to justify candidate-edge claims.
- Prompt must enforce the output reasoning contract (see doc-24 Output Contract):
  - **Run-level 5-layer narrative** (TASK-160): `competitiveMoat`, `selectionMethodology`, `marketContext`, `executiveSummary`, `landscapeTrends?`
  - **Run-level synthesis**: `objectiveRecommendations[]` (for/X → recommended companies), `applicationPlan` (dated phases tied to SearchTimeline.deadline), `visualizations[]` (Mermaid source) when appropriate
  - **Run-level feedback**: `surprises[]`, `rejectedCandidates[]`, `nextSteps[]`, `references[]` (resolved citation URLs)
  - **Run-level transparency**: `assumptions[]` (TASK-185) — every gap-filled input listed with claim + confidence
  - **Per-result core**: `candidateEdge` as 2-4 sentences of prose using the candidate-fact + company-fact + interpretation formula
  - **Per-result enrichment**: `openRoles[]`, richer `companyIntel` (whatTheyDo, scale, stage, team, aiCulture narrative), narrative `interviewProcess`, `edge` (one-line compressed), `keyRequirements[]` (compressed phrases), `caveat?` (freshness/hiring-pause warning)
  - **Per-result directives** (TASK-183, when `SearchRequest.resumeVariants` is set): `recommendedVariant`, `bulletEdits[]` (3 bullets: 1 lead + 2 supporting, first-person past-tense with metrics, under 30 words each), `keywordsToInclude[]` (8-12 posting-specific phrases)
  - **Citations** (TASK-184): every factual claim (interview process, compensation, company size, team structure, hiring status) attributed via `[cite:<id>]` inline markers resolving to entries in `citations[]`
  - Specify: "Do not collapse reasoning into fragments. Fields labeled 'narrative' or 'summary' expect prose. Fields labeled 'edge' or 'reason' expect 2-4 sentences. Structured output does not mean terse output. Every factual claim must be cited — if you can't attribute it, don't claim it."

**Progress UI:**
- Phase indicator with current step name (from `job.progress.phase`) and elapsed timer (from `job.startedAt`)
- Activity indicator; "Typical 10-20 min" hint
- Cancel button posts to `/research/jobs/:id/cancel`
- Background execution — search continues regardless of tab state because job runs server-side
- Browser notification (Notification API) when `completed` is first observed
- Results persist via `searchStore` SearchRun hydration — user returns to see completed report
- Reload/rejoin path: Research workspace mount checks for in-flight jobId, resumes polling

**Validation on job result hydration:**
- Assert narrative fields present and meet minimum length
- Log contract violations to telemetry; show "regenerate" affordance if executiveSummary or searchApproach is missing/too short
- Assert `candidateEdge` is at least 2 sentences per result; flag degraded results in UI
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Client calls POST /research/jobs to create a job and receives a jobId immediately (no waiting)
- [ ] #2 Client polls GET /research/jobs/:id with exponential backoff (2s/5s/15s/30s cap); pauses on visibilitychange=hidden
- [ ] #3 Optional SSE subscription to /research/jobs/:id/stream is opened when tab is foregrounded; gracefully degrades to polling-only when unavailable
- [ ] #4 Deep research prompt sends thesis + identity evidence (archetype, arc, PAIO highlights, calibrations) — not thesis alone
- [ ] #5 Prompt enforces reasoning output contract: executiveSummary, searchApproach, surprises[], rejectedCandidates[] at run level; candidateEdge as 2-4 sentences per result
- [ ] #6 Results include candidateEdge, interviewProcess, companyIntel, signalGroup, advantageMatch where available
- [ ] #7 Progress UI shows current phase, elapsed timer, and activity indicator from the polled job record
- [ ] #8 Cancel button posts to /research/jobs/:id/cancel and preserves thesis for retry
- [ ] #9 Research workspace mount detects in-flight jobId in searchStore and rejoins polling
- [ ] #10 Browser notification fires when search completes while tab is hidden
- [ ] #11 Job result hydrates narrative + results + tokenUsage into SearchRun in searchStore
- [ ] #12 Contract violations (missing/short narrative, fragment candidateEdge) are flagged in UI and logged to telemetry
- [ ] #13 Error states display clearly and preserve thesis for retry
- [ ] #14 Works across reload, tab close, network switches, and multi-device sessions (job is durable server-side)
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
