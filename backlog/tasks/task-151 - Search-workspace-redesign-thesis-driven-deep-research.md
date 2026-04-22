---
id: TASK-151
title: 'Search workspace redesign: thesis-driven deep research'
status: To Do
assignee: []
created_date: '2026-04-19 05:59'
updated_date: '2026-04-19 06:00'
labels:
  - search-redesign
  - parent
milestone: m-23
dependencies: []
references:
  - src/utils/searchExecutor.ts
  - src/utils/identitySearchProfile.ts
  - src/routes/research/ResearchPage.tsx
  - src/types/search.ts
  - src/store/searchStore.ts
documentation:
  - 'backlog doc-24: Search Workspace Redesign'
  - 'backlog doc-26: Shepherding Design (Stage 2 and 3)'
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Parent task for the complete search workspace redesign. The current search sends a flat skill list to Sonnet and gets thin results. The redesign introduces a two-phase hybrid architecture with an async-job transport for Phase 2.

**Phase 1: Thesis Generation (Interactive)** — Opus analyzes the identity model and produces a search thesis (competitive moat, unfair advantage combinations, search lanes, interview strategy, skill depth map, cohesive narrative). User reviews, corrects, and approves before the expensive search. TASK-151.1.

**Phase 2: Deep Research Execution (Async Job + Task Budget)** — Client posts approved thesis + identity evidence to `POST /research/jobs`, gets `jobId` immediately. Server-side runner executes Opus Task Budgets call (10-20 minutes). Client polls (and optionally subscribes via SSE) for status. Results persist to durable storage regardless of client connection state. TASK-151.2 (client) + TASK-161 (server infra) + TASK-162 (SSE enhancement).

**Why async job instead of single long-held fetch:** tab close, page reload, network switches, and OS tab suspension all kill long-held connections. At 10-20 minutes and $5-15 per invocation, durability is mandatory — not optional.

Full design in backlog doc-24. Reference material: founder's job search reports demonstrate the quality bar.

### Subtask Tree

**Foundation (M1 — m-20)**
- TASK-150 ✅ Identity schema extensions (semantic depth, calibration, filter conditions)
- TASK-152 ✅ SearchThesis and enriched SearchResultEntry types
- TASK-159 Identity version counter and skill depth writeback precedence
- TASK-160 SearchRunNarrative (5-layer) + ApplicationPlan + visualizations + narrative fields on SearchThesis/SearchRun + ResearchJob type
- TASK-163 SearchFeedbackEvent schema and store contract
- TASK-167 Harden JSON extraction for long-form model outputs
- TASK-183 Resume-variant + bulletEdits + keywords on SearchResultEntry (+ SearchRequest input)
- TASK-184 Citation type + inline/footnote rendering
- TASK-185 Explicit-assumptions transparency

**Proxy / Infrastructure (M2 — m-21)**
- TASK-153 Parameter pass-through (output_config, betas, max_tokens, web_search tool version)
- TASK-161 Async research job infrastructure (storage, endpoints, runner lifecycle)
- TASK-162 SSE subscription endpoint (optional enhancement)

**Search Thesis (M4 — m-23)**
- TASK-151.1 Thesis generation engine and thesis editor UI
- TASK-166 Opus unavailability fallback (Phase 1) and Phase 2 hard-requirement documentation

**Deep Research (M5 — m-24)**
- TASK-151.2 Deep research execution (async job client) and progress UI
- TASK-164 Cost guardrails (estimate, budget ceiling, double-submit guard)

**Pipeline Flow (M6 — m-25)**
- TASK-151.3 Enriched search→pipeline mapping and result feedback loop
- TASK-165 Fix conditional-filter match scoring and propagate conditions through search profile

**Cross-Cutting Shepherding**
- TASK-168 Compute and display downstream impact of identity corrections
- TASK-172 Unify feedback event pattern across domains
- TASK-174 Harden AI-export ingestion against prompt injection
- TASK-175 Multi-tab concurrency and identity-version conflict handling
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 End-to-end integration test with fixture Anthropic responses validates the full round-trip: identity → thesis generation → thesis approval → job creation → runner execution → enriched results → pipeline entry draft → result feedback → identity writeback → thesis regeneration picks up feedback
- [ ] #2 The E2E test uses deterministic fixtures (no live Anthropic calls) and asserts: narrative fields present with minimum lengths, candidateEdge is 2-4 sentences, signalGroup→tier mapping applied, identity version bumps on writeback, feedback events flow from result to thesis
- [ ] #3 E2E test runs in CI alongside existing Vitest suite
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
