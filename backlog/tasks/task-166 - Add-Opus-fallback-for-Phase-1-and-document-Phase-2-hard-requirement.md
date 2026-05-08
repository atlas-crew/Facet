---
id: TASK-166
title: >-
  Add Opus unavailability fallback for Phase 1 and document Phase 2 hard
  requirement
status: Done
assignee:
  - '@codex'
created_date: '2026-04-19 09:30'
updated_date: '2026-05-08 01:57'
labels:
  - search-redesign
  - resilience
  - proxy
milestone: m-23
dependencies:
  - TASK-151.1
references:
  - src/utils/searchExecutor.ts
  - src/utils/llmProxy.ts
  - src/utils/aiProxyErrors.ts
documentation:
  - 'backlog doc-24: Key Risks section'
modified_files:
  - >-
    backlog/docs/doc-24 -
    Search-Workspace-Redesign-—-Search-Thesis-Semantic-Depth-Feedback-Loop.md
  - proxy/facetServer.js
  - proxy/researchJobs.js
  - src/types/search.ts
  - src/utils/aiProxyErrors.ts
  - src/utils/llmProxy.ts
  - src/utils/thesisGenerator.ts
  - src/routes/research/ResearchPage.tsx
  - src/test/aiProxyErrors.test.ts
  - src/test/llmProxy.test.ts
  - src/test/thesisGenerator.test.ts
  - src/test/facetServer.test.ts
  - src/test/researchJobs.test.ts
  - src/test/ResearchPage.test.tsx
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The redesign pins both phases to Opus. If Opus is unavailable (proxy-side feature flag, regional outage, quota exhaustion), both phases fail hard today. Add a graceful path for Phase 1 and an unambiguous error message for Phase 2.

**Phase 1 — Opus unavailable → Sonnet fallback with quality warning:**
- Detect Opus unavailability from proxy error payload (distinct error code, or configured capability advertise)
- Offer the user a Sonnet-based thesis generation with a clear quality advisory:
  > "Opus is temporarily unavailable. Generating with Sonnet will produce a usable but less deeply reasoned thesis. You can regenerate when Opus is back."
- Thesis generated with Sonnet is tagged `source: 'generated-fallback'` (extend `SearchThesisSource` union) so UI can surface "regenerate with Opus" when availability returns
- Preserves user momentum — the $149/90-day pass doesn't want to be blocked by transient Opus outages

**Phase 2 — Opus unavailable → hard fail with clear message:**
- Deep research is Opus-required (Task Budgets + 80K budget + 20 web searches need Opus-class reasoning)
- `POST /research/jobs` (TASK-161) should check capability before enqueueing and return a clear error:
  > "Deep research requires Opus, which is currently unavailable. Your thesis is preserved — try again shortly."
- Client surfaces the message non-destructively (thesis preserved, "Retry when available" affordance)
- Do NOT silently fall back to Sonnet for Phase 2 — the cost is paid regardless of model, but quality degradation for the deep research is unacceptable

**Capability advertisement:**
- Proxy exposes a capability endpoint or includes capabilities in health/status responses: `{ models: { opus: 'available' | 'degraded' | 'unavailable' } }`
- Client caches capability status for short windows (30-60s) and refreshes on submission errors
- Prevents the client from offering "Run Search" when Opus is known unavailable

**Out of scope:**
- Model quality comparison across providers — this task is Anthropic-only resilience
- Automatic retry queues — the user retries manually
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Proxy exposes Opus capability status (via endpoint or health check)
- [x] #2 Client detects Opus unavailability from proxy responses
- [x] #3 Phase 1 offers Sonnet fallback with explicit quality warning; fallback-generated theses tagged source='generated-fallback'
- [x] #4 Fallback-tagged theses show a "Regenerate with Opus" affordance when Opus returns to available
- [x] #5 Phase 2 does NOT fall back to Sonnet; POST /research/jobs returns a clear capability error when Opus is unavailable
- [x] #6 Client surfaces Phase 2 unavailability non-destructively (thesis preserved, retry affordance)
- [x] #7 Tests cover: Opus available (happy path), Opus unavailable on Phase 1 (fallback accepted/declined), Opus unavailable on Phase 2 (hard fail)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Add model capability handling for Opus availability: expose proxy-side status, hard-fail Phase 2 research job creation when Opus is unavailable, add Phase 1 fallback tagging/warning without changing research job request-shape cleanup, cover proxy/client behavior with focused tests, then commit only TASK-166 files.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Taking over locally after TASK-199 lanes-only request cleanup landed. Scope stays on Opus capability/fallback behavior and avoids unrelated search-shape refactors.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented Opus capability handling for research resiliency:
- Proxy exposes GET /capabilities with Opus availability and blocks Opus-routed AI calls with ai_capability_unavailable/opus_unavailable when disabled.
- Phase 1 thesis generation can use an explicit Sonnet fallback only after user confirmation; fallback requests send capability_fallback=opus_unavailable and save source=generated-fallback.
- Fallback theses show Regenerate with Opus when capability status reports Opus available.
- Phase 2 /research/jobs checks Opus availability before enqueue and hard-fails without creating a job; client preserves the reviewed thesis and surfaces retry-safe error state.
- doc-24 documents the Phase 1 fallback and Phase 2 Opus hard requirement.

Verification:
- npx vitest run src/test/aiProxyErrors.test.ts src/test/llmProxy.test.ts src/test/thesisGenerator.test.ts src/test/researchJobs.test.ts src/test/ResearchPage.test.tsx: 125 passed
- npx vitest run src/test/facetServer.test.ts -t "exposes Opus capability status": 1 passed
- npm run typecheck: passed
- npx eslint <TASK-166 touched files>: passed
- npm run build: passed

Known unrelated baseline:
- npm run lint still fails on generated .vercel/dist-unmin artifacts and existing unrelated source/test lint debt.
- Full src/test/facetServer.test.ts still has unrelated persistence snapshot failures expecting 200 but receiving invalid_snapshot 400.
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
