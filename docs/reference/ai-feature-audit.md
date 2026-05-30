# AI Feature Audit

This document inventories the AI-enabled product surfaces in Facet as of the current codebase state. It focuses on:

- route and UI entrypoint
- helper or generator used
- proxy `feature` key
- caller model alias versus effective upstream model
- explicit caller-side parameters
- shared proxy defaults and hosted access enforcement

## Shared Runtime

Most AI features call the shared proxy helper in [src/utils/llmProxy.ts](/Users/nick/Developer/Facet/src/utils/llmProxy.ts:73).

Shared caller defaults:

- `temperature`: `0.3` unless the caller overrides it
- `timeoutMs`: `30000` unless the caller overrides it
- request body includes `system`, `messages`, optional `model`, and optional `feature`

Proxy nuance for current upstream models:

- the proxy omits `temperature` when the resolved upstream model is in `MODELS_OMIT_TEMPERATURE` (currently `claude-opus-4-7` and `claude-sonnet-4-6`), because those models reject temperature in non-thinking requests on the Anthropic Messages API
- the proxy translates `thinking_budget` into adaptive thinking (`thinking: { type: 'adaptive' }`) for models in `ADAPTIVE_THINKING_MODELS` (`claude-opus-4-7`, `claude-sonnet-4-6`); manual `budget_tokens` is rejected by these models
- the proxy maps `thinking_budget` magnitude to an `output_config.effort` level on models in `MODELS_ACCEPT_EFFORT` (same set today); Sonnet 4.5 and Haiku 4.5 reject the `effort` parameter
- Haiku and legacy Sonnet 4 (`claude-sonnet-4-20250514`) still receive caller/default temperature when thinking is disabled

Base model aliases are resolved in [proxy/facetServer.js](/Users/nick/Developer/Facet/proxy/facetServer.js:84):

| Alias | Upstream model |
| --- | --- |
| `haiku` | `claude-haiku-4-5-20251001` |
| `sonnet` | `claude-sonnet-4-6` |
| `opus` | `claude-opus-4-7` |

The proxy applies per-feature model defaults before the upstream request is sent (see `FEATURE_MODEL_DEFAULTS` in `proxy/facetServer.js`). The product-tiering rationale: Opus 4.7 for quality-critical user-facing output, Sonnet 4.6 for structured transformation, Haiku 4.5 for mechanical field extraction.

| Tier | Effective upstream model | Features |
| --- | --- | --- |
| Quality-critical | `claude-opus-4-7` | `identity.deepen`, `prep.generate`, `linkedin.generate`, `research.profile-inference`, `research.thesis`, `research.deep-search`, `pipeline.t3.interviewer` |
| Structured transformation | `claude-sonnet-4-6` | `identity.extract`, `build.bullet-reframe`, `letters.generate`, `debrief.generate`, `research.search` |
| Mechanical extraction | `claude-haiku-4-5-20251001` | `match.jd-analysis` |

The proxy also raises the per-call `max_tokens` ceiling to `128_000` for `TASK_BUDGET_FEATURES` (`research.deep-search`, `research.thesis`, `letters.generate`) when the caller requests a higher cap.

Current proxy defaults:

- default upstream model (`DEFAULT_MODEL`): `claude-sonnet-4-6`
- default `max_tokens`: `4096` (env-overridable via `MAX_TOKENS`)
- default `thinking_budget`: `0` (env-overridable via `THINKING_BUDGET`)
- if thinking is enabled, the proxy sends `thinking` (or `effort`, depending on model) instead of `temperature`
- if the resolved model is in `MODELS_OMIT_TEMPERATURE`, the proxy omits `temperature` even when thinking is disabled
- allowed tool types today: `web_search_20250305`, `web_search_20260209`

## Hosted Access Model

Hosted AI requests must declare a valid `feature` key and pass entitlement checks in the proxy before the upstream model call is made.

Relevant files:

- [proxy/aiFeatures.js](/Users/nick/Developer/Facet/proxy/aiFeatures.js:1)
- [proxy/aiAccess.js](/Users/nick/Developer/Facet/proxy/aiAccess.js:11)
- [proxy/facetServer.js](/Users/nick/Developer/Facet/proxy/facetServer.js:786)

Current valid hosted AI feature keys (from `FACET_AI_FEATURE_KEYS` in [proxy/aiFeatures.js](/Users/nick/Developer/Facet/proxy/aiFeatures.js:1)):

- `build.bullet-reframe`
- `identity.extract`
- `identity.deepen`
- `match.jd-analysis`
- `pipeline.t3.interviewer` *(declared, unwired today)*
- `research.deep-search` *(declared, unwired in the UI today; runtime path exists in tests)*
- `research.profile-inference`
- `research.search`
- `research.thesis`
- `prep.generate`
- `letters.generate`
- `linkedin.generate`
- `debrief.generate`

The Build workspace's prior `build.jd-analysis` feature was retired by the JD-analysis consolidation refactor (see `docs/development/refactors/2026-04-jd-analysis-consolidation.md`). JD analysis is now a pipeline-anchored canonical entity rather than a Build-local AI feature.

Product invariant today: all valid hosted AI feature keys are included in AI Pro (`AI_PRO_FEATURES === FACET_AI_FEATURE_KEYS`).

## Feature Matrix

The "Effective upstream model" column shows what the proxy actually sends after `FEATURE_MODEL_DEFAULTS` is applied — feature defaults override caller-supplied aliases for routed lanes (raw explicit model ids remain an escape hatch).

| Product surface | Route entrypoint | Helper | Feature key | Caller model alias | Effective upstream model | Explicit caller params |
| --- | --- | --- | --- | --- | --- | --- |
| Build: bullet reframe | [src/routes/build/BuildPage.tsx](/Users/nick/Developer/Facet/src/routes/build/BuildPage.tsx:1150) | `reframeBulletForVector` | `build.bullet-reframe` | `haiku` | `claude-sonnet-4-6` | `temperature: 0` |
| Match: identity vs JD | [src/routes/match/MatchPage.tsx](/Users/nick/Developer/Facet/src/routes/match/MatchPage.tsx:259) | `analyzeIdentityJobMatch` | `match.jd-analysis` | `sonnet` | `claude-haiku-4-5-20251001` | `temperature: 0.1`, `timeoutMs: 60000` |
| Identity: draft extraction | [src/routes/identity/IdentityPage.tsx](/Users/nick/Developer/Facet/src/routes/identity/IdentityPage.tsx:282) | `generateIdentityDraft` | `identity.extract` | `sonnet` | `claude-sonnet-4-6` | `temperature: 0.2`, `timeoutMs: 120000` |
| Identity: bullet deepen | [src/routes/identity/IdentityPage.tsx](/Users/nick/Developer/Facet/src/routes/identity/IdentityPage.tsx:463) | `deepenIdentityBullet` | `identity.deepen` | `sonnet` | `claude-opus-4-7` | `temperature: 0.1`, `timeoutMs: 120000` |
| Identity: skill enrichment suggestion | [src/routes/identity/IdentityEnrichmentSkillPage.tsx](/Users/nick/Developer/Facet/src/routes/identity/IdentityEnrichmentSkillPage.tsx:328) | `generateSkillEnrichmentSuggestion` | `identity.extract` | `haiku` | `claude-sonnet-4-6` | `timeoutMs: 45000`, temp inherits `0.3` |
| Identity strategy: generate full strategy | [src/routes/identity/bands/SearchStrategyBand.tsx](/Users/nick/Developer/Facet/src/routes/identity/bands/SearchStrategyBand.tsx:475) | `generateStrategicPositioningFromIdentity` | `research.profile-inference` | `opus` | `claude-opus-4-7` | `timeoutMs: 90000`, temp inherits `0.3` |
| Identity strategy: generate search vectors | [src/routes/identity/bands/SearchStrategyBand.tsx](/Users/nick/Developer/Facet/src/routes/identity/bands/SearchStrategyBand.tsx:402) | `generateSearchVectorsFromIdentity` | `research.profile-inference` | `opus` | `claude-opus-4-7` | `timeoutMs: 90000`, temp inherits `0.3` |
| Identity strategy: generate awareness | [src/routes/identity/bands/SearchStrategyBand.tsx](/Users/nick/Developer/Facet/src/routes/identity/bands/SearchStrategyBand.tsx:420) | `generateAwarenessFromIdentity` | `research.profile-inference` | `opus` | `claude-opus-4-7` | `timeoutMs: 90000`, temp inherits `0.3` |
| Research: infer profile from resume | [src/routes/research/ResearchPage.tsx](/Users/nick/Developer/Facet/src/routes/research/ResearchPage.tsx:404) | `inferSearchProfile` | `research.profile-inference` | `haiku` | `claude-opus-4-7` | `timeoutMs: 90000`, temp inherits `0.3` |
| Research: infer profile from identity | [src/routes/research/ResearchPage.tsx](/Users/nick/Developer/Facet/src/routes/research/ResearchPage.tsx:388) | `inferSearchProfileFromIdentity` | `research.profile-inference` | `haiku` | `claude-opus-4-7` | `timeoutMs: 90000`, temp inherits `0.3` |
| Research: execute live search | [src/routes/research/ResearchPage.tsx](/Users/nick/Developer/Facet/src/routes/research/ResearchPage.tsx:448) | `executeSearch` | `research.search` | `sonnet` | `claude-sonnet-4-6` | `temperature: 1`, `thinking_budget: 8000`, `tools: web_search_*`, `max_uses: 15`, request timeout `120000` |
| Research: thesis generation | [src/utils/thesisGenerator.ts](/Users/nick/Developer/Facet/src/utils/thesisGenerator.ts:479) | `generateThesis` | `research.thesis` | `sonnet` | `claude-opus-4-7` | task-budget feature; raised `max_tokens` cap up to `128000` |
| Pipeline: investigate job entry | [src/routes/pipeline/PipelinePage.tsx](/Users/nick/Developer/Facet/src/routes/pipeline/PipelinePage.tsx:166) | `investigatePipelineEntry` via `callSearchProxy` | `research.search` | `sonnet` | `claude-sonnet-4-6` | same as research search lane |
| Prep: generate interview prep | [src/routes/prep/PrepPage.tsx](/Users/nick/Developer/Facet/src/routes/prep/PrepPage.tsx:514) | `generateInterviewPrep` | `prep.generate` | `sonnet` | `claude-opus-4-7` | `timeoutMs: 90000`, temp inherits `0.3` |
| Prep: regenerate/update interview prep | [src/routes/prep/PrepPage.tsx](/Users/nick/Developer/Facet/src/routes/prep/PrepPage.tsx:592), [src/routes/prep/PrepPage.tsx](/Users/nick/Developer/Facet/src/routes/prep/PrepPage.tsx:1031) | `generateInterviewPrep` | `prep.generate` | `sonnet` | `claude-opus-4-7` | `timeoutMs: 90000`, temp inherits `0.3` |
| Letters: cover letter generation | [src/routes/letters/LettersPage.tsx](/Users/nick/Developer/Facet/src/routes/letters/LettersPage.tsx:189), [src/routes/letters/LettersPage.tsx](/Users/nick/Developer/Facet/src/routes/letters/LettersPage.tsx:251) | `generateCoverLetter` | `letters.generate` | `sonnet` | `claude-sonnet-4-6` | `timeoutMs: 45000`, temp inherits `0.3`; task-budget feature (raised `max_tokens` cap) |
| LinkedIn: profile generation | [src/routes/linkedin/LinkedInPage.tsx](/Users/nick/Developer/Facet/src/routes/linkedin/LinkedInPage.tsx:109) | `generateLinkedInProfile` | `linkedin.generate` | `sonnet` | `claude-opus-4-7` | `timeoutMs: 45000`, temp inherits `0.3` |
| Debrief: report generation | [src/routes/debrief/DebriefPage.tsx](/Users/nick/Developer/Facet/src/routes/debrief/DebriefPage.tsx:190) | `generateDebriefReport` | `debrief.generate` | `sonnet` | `claude-sonnet-4-6` | `timeoutMs: 45000`, temp inherits `0.3` |

## UI Availability vs Proxy Enforcement

Most pages do not pre-check feature-specific entitlement on the client. Instead they:

- verify that `facetClientEnv.anthropicProxyUrl` exists
- sanitize it into an `aiEndpoint`
- send the request with a `feature` key
- rely on proxy-side denial payloads for hosted billing and entitlement failures

Examples:

- [src/routes/prep/PrepPage.tsx](/Users/nick/Developer/Facet/src/routes/prep/PrepPage.tsx:257)
- [src/routes/research/ResearchPage.tsx](/Users/nick/Developer/Facet/src/routes/research/ResearchPage.tsx:169)
- [src/routes/letters/LettersPage.tsx](/Users/nick/Developer/Facet/src/routes/letters/LettersPage.tsx:40)
- [src/utils/aiProxyErrors.ts](/Users/nick/Developer/Facet/src/utils/aiProxyErrors.ts:126)

This means the effective gating model is:

1. client checks whether AI is configured at all
2. proxy validates the feature key
3. proxy validates hosted entitlement for that feature
4. proxy resolves the model alias and applies token, temperature, thinking, and tool policy

## Notes

- Feature-based proxy routing now overrides generic caller aliases for selected lanes. Raw explicit model ids are still preserved as an escape hatch for targeted testing.
- No current feature caller explicitly sets `max_tokens`; that is inherited from the proxy default unless the proxy environment overrides it.
- `research.profile-inference` and `identity.extract` each back multiple distinct product experiences, so the entitlement taxonomy is broader than the visible route taxonomy.
