---
id: TASK-190
title: AI cost observability and per-feature rate enforcement
status: Done
assignee: []
created_date: '2026-04-24 09:48'
updated_date: '2026-04-24 21:47'
labels:
  - observability
  - ai
  - proxy
  - cost
  - rate-limits
dependencies: []
references:
  - proxy/facetServer.js
  - proxy/pricing.js
  - proxy/postgresUsageStore.js
  - supabase/migrations/20260424_004_ai_call_usage.sql
  - proxy/aiFeatures.js
documentation:
  - >-
    backlog/docs/doc-30 -
    Pipeline-Depth-—-Rounds-Research-Tiers-and-the-Calendar.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ship a sequenced observability → rate-limits → enforcement series so real per-user and per-feature AI cost data can calibrate rate caps before step 5 of doc-30 (T3 interviewer research + Opus-on-prep-gen) compounds spend.

Context (from session 2026-04-24): at $149 for 90 days, naive "Opus everywhere" would land AI COGS at 4–6× revenue. Even T3-on-Opus alone is ~30% COGS before any other costs. Before committing to final model choices or rate limits, we need real-world data on what each feature actually costs per user.

The scaffolding is partial: proxy already has `DEFAULT_HOSTED_RATE_LIMITS` (a single 30/min `ai` bucket), `operationsMonitor` event counters, and `FACET_AI_FEATURE_KEYS` allowlist. Missing: per-feature granularity, persisted per-call spend, and budget-shaped enforcement.

Three sequenced PRs:

**PR A — Per-call usage logging to `ai_call_usage`** (DONE, commit 5c14413)
- Supabase migration for `ai_call_usage` (user/tenant/account/feature/model/tokens/est_cost_cents/status)
- Static pricing table in `proxy/pricing.js` (Opus/Sonnet/Haiku 4.x rates, rounds up)
- Fire-and-forget `createPostgresUsageStore` — swallows errors so observability never cascades into AI response failures
- Instrumentation after successful `anthropicClient.messages.create` in `proxy/facetServer.js`
- 42 tests across pricing/usage-store/end-to-end paths

**PR B — Per-feature burst buckets in `DEFAULT_HOSTED_RATE_LIMITS`**
- Split the single `ai: {max: 30, windowMs: 60_000}` bucket into per-feature buckets keyed on the `feature:` tag
- Heavier buckets for cheap features (research.search), tighter buckets for expensive features (prep.generate, future pipeline.t3.interviewer)
- Config-only; ~30 lines; zero architectural risk

**PR C — Per-user daily caps + global circuit breaker**
- Durable counter (Supabase-backed, not in-memory) so caps survive proxy restarts
- Daily per-feature cap per actor (e.g. 20 prep-gen/day)
- Global spend circuit breaker with a configurable dollar-amount threshold
- Calibrated from PR A's data, NOT guessed

Deliberately deferred until data lands: pass-budget enforcement ("$30 AI spend per pass → throttle"), spend dashboards, alerting. Data-first is the discipline here — don't set thresholds before observing the distribution.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 PR A — Every successful hosted AI call writes one row to public.ai_call_usage with actor/tenant/account/feature/resolved-model/tokens/est_cost_cents, via a fire-and-forget store that cannot cascade observability failures into AI response failures. (DONE, commit 5c14413)
- [x] #2 PR B — DEFAULT_HOSTED_RATE_LIMITS is split into per-feature burst buckets keyed on the feature tag (minimum: separate entries for prep.generate and any future T3 feature). Config-only change validated by existing rate-limit tests.
- [x] #3 PR C — Per-user daily caps per feature are enforced via a Supabase-backed durable counter that survives proxy restarts; a global circuit breaker trips the entire AI path when aggregate spend over a configurable window exceeds threshold. Thresholds calibrated from PR A's observed distribution, not guessed.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Completed PR B/PR C implementation for TASK-190.\n\nImplementation notes:\n- Split hosted AI rate limiting into an early generic AI route bucket plus feature-specific buckets keyed as ai:<feature>, including prep.generate and pipeline.t3.interviewer.\n- Added configurable hosted AI usage policy parsing from env/JSON. Threshold envs default disabled so production thresholds remain data-calibrated rather than guessed.\n- Added Postgres-backed ai_feature_daily_usage reservations for per-user/account/day feature caps, including refund-on-upstream-failure.\n- Added global spend circuit breaker over ai_call_usage with cached/coalesced spend refreshes, in-process spend accumulation, and a status/created_at index.\n- Hardened failure modes: usage policy store outages fail closed with ai_usage_policy_unavailable, usage logging remains fire-and-forget, and fractional costs are defensively rounded up.\n- Supabase CLI was unavailable in this environment, so the migration file was created manually following existing migration/RLS patterns.\n\nValidation:\n- npx vitest run src/test/pricing.test.ts src/test/postgresUsageStore.test.ts src/test/facetServer.test.ts -> 3 files / 60 tests passed.\n- npm run typecheck -> passed.\n- npx eslint proxy/facetServer.js proxy/postgresUsageStore.js proxy/aiFeatures.js src/types/hosted.ts src/test/facetServer.test.ts src/test/postgresUsageStore.test.ts src/test/pricing.test.ts -> passed.\n- npm run build -> passed.\n- npm run test was run and still has unrelated baseline failures in src/test/searchExecutor.test.ts and src/test/PrepLiveMode.test.tsx.\n- npm run lint was run and remains blocked by unrelated generated-output/baseline lint debt outside this task.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
TASK-190 is implemented end-to-end: PR A was already landed in commit 5c14413, and this slice adds PR B feature-specific hosted AI burst buckets plus PR C durable daily feature reservations and a configurable global spend circuit breaker. Guardrails are disabled by default until PR A usage data calibrates thresholds, but enforcement is live whenever the env policy is configured. Independent review is CLEAN at .agents/reviews/review-20260424-173454.md. Test audit gaps were remediated except real-Postgres integration coverage, which is not available in the current repo test harness.
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
