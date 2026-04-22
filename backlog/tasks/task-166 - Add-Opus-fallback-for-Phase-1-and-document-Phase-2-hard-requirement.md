---
id: TASK-166
title: Add Opus unavailability fallback for Phase 1 and document Phase 2 hard requirement
status: To Do
assignee: []
created_date: '2026-04-19 09:30'
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
- [ ] #1 Proxy exposes Opus capability status (via endpoint or health check)
- [ ] #2 Client detects Opus unavailability from proxy responses
- [ ] #3 Phase 1 offers Sonnet fallback with explicit quality warning; fallback-generated theses tagged source='generated-fallback'
- [ ] #4 Fallback-tagged theses show a "Regenerate with Opus" affordance when Opus returns to available
- [ ] #5 Phase 2 does NOT fall back to Sonnet; POST /research/jobs returns a clear capability error when Opus is unavailable
- [ ] #6 Client surfaces Phase 2 unavailability non-destructively (thesis preserved, retry affordance)
- [ ] #7 Tests cover: Opus available (happy path), Opus unavailable on Phase 1 (fallback accepted/declined), Opus unavailable on Phase 2 (hard fail)
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
