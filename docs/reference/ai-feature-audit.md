# AI Feature Audit

This document inventories the AI-enabled product surfaces in Facet as of the current codebase state. It focuses on:

- route and UI entrypoint
- helper or generator used
- proxy `feature` key
- model alias and resolved upstream model
- explicit caller-side parameters
- shared proxy defaults and hosted access enforcement

## Shared Runtime

Most AI features call the shared proxy helper in [src/utils/llmProxy.ts](/Users/nick/Developer/Facet/src/utils/llmProxy.ts:73).

Shared caller defaults:

- `temperature`: `0.3` unless the caller overrides it
- `timeoutMs`: `30000` unless the caller overrides it
- request body includes `system`, `messages`, optional `model`, and optional `feature`

Model aliases are resolved in [proxy/facetServer.js](/Users/nick/Developer/Facet/proxy/facetServer.js:38):

| Alias | Upstream model |
| --- | --- |
| `haiku` | `claude-haiku-4-5-20251001` |
| `sonnet` | `claude-sonnet-4-20250514` |
| `opus` | `claude-opus-4-20250514` |

Current proxy defaults:

- default upstream model: `claude-sonnet-4-20250514`
- default `max_tokens`: `4096`
- default `thinking_budget`: `0`
- if thinking is enabled, the proxy sends `thinking` instead of `temperature`
- allowed tool type today: `web_search_20250305`

## Hosted Access Model

Hosted AI requests must declare a valid `feature` key and pass entitlement checks in the proxy before the upstream model call is made.

Relevant files:

- [proxy/aiFeatures.js](/Users/nick/Developer/Facet/proxy/aiFeatures.js:1)
- [proxy/aiAccess.js](/Users/nick/Developer/Facet/proxy/aiAccess.js:11)
- [proxy/facetServer.js](/Users/nick/Developer/Facet/proxy/facetServer.js:786)

Current valid hosted AI feature keys:

- `build.jd-analysis`
- `build.bullet-reframe`
- `identity.extract`
- `identity.deepen`
- `match.jd-analysis`
- `research.profile-inference`
- `research.search`
- `prep.generate`
- `letters.generate`
- `linkedin.generate`
- `debrief.generate`

Product invariant today: all valid hosted AI feature keys are included in AI Pro.

## Feature Matrix

| Product surface | Route entrypoint | Helper | Feature key | Model alias | Upstream model | Explicit caller params |
| --- | --- | --- | --- | --- | --- | --- |
| Build: JD analysis | [src/routes/build/BuildPage.tsx](/Users/nick/Developer/Facet/src/routes/build/BuildPage.tsx:632) | `analyzeJobDescription` | `build.jd-analysis` | `haiku` | Claude Haiku 4.5 | `temperature: 0` |
| Build: bullet reframe | [src/routes/build/BuildPage.tsx](/Users/nick/Developer/Facet/src/routes/build/BuildPage.tsx:660) | `reframeBulletForVector` | `build.bullet-reframe` | `haiku` | Claude Haiku 4.5 | `temperature: 0` |
| Match: identity vs JD | [src/routes/match/MatchPage.tsx](/Users/nick/Developer/Facet/src/routes/match/MatchPage.tsx:90) | `analyzeIdentityJobMatch` | `match.jd-analysis` | `sonnet` | Claude Sonnet 4 | `temperature: 0.1`, `timeoutMs: 60000` |
| Identity: draft extraction | [src/routes/identity/IdentityPage.tsx](/Users/nick/Developer/Facet/src/routes/identity/IdentityPage.tsx:282) | `generateIdentityDraft` | `identity.extract` | `sonnet` | Claude Sonnet 4 | `temperature: 0.2`, `timeoutMs: 120000` |
| Identity: bullet deepen | [src/routes/identity/IdentityPage.tsx](/Users/nick/Developer/Facet/src/routes/identity/IdentityPage.tsx:463) | `deepenIdentityBullet` | `identity.deepen` | `sonnet` | Claude Sonnet 4 | `temperature: 0.1`, `timeoutMs: 120000` |
| Identity: skill enrichment suggestion | [src/routes/identity/IdentityEnrichmentSkillPage.tsx](/Users/nick/Developer/Facet/src/routes/identity/IdentityEnrichmentSkillPage.tsx:328) | `generateSkillEnrichmentSuggestion` | `identity.extract` | `haiku` | Claude Haiku 4.5 | `timeoutMs: 45000`, temp inherits `0.3` |
| Identity strategy: generate search vectors | [src/routes/identity/IdentityStrategyWorkbench.tsx](/Users/nick/Developer/Facet/src/routes/identity/IdentityStrategyWorkbench.tsx:552) | `generateSearchVectorsFromIdentity` | `research.profile-inference` | `haiku` | Claude Haiku 4.5 | `timeoutMs: 45000`, temp inherits `0.3` |
| Identity strategy: generate awareness | [src/routes/identity/IdentityStrategyWorkbench.tsx](/Users/nick/Developer/Facet/src/routes/identity/IdentityStrategyWorkbench.tsx:582) | `generateAwarenessFromIdentity` | `research.profile-inference` | `haiku` | Claude Haiku 4.5 | `timeoutMs: 45000`, temp inherits `0.3` |
| Research: infer profile from resume | [src/routes/research/ResearchPage.tsx](/Users/nick/Developer/Facet/src/routes/research/ResearchPage.tsx:404) | `inferSearchProfile` | `research.profile-inference` | `haiku` | Claude Haiku 4.5 | `timeoutMs: 45000`, temp inherits `0.3` |
| Research: infer profile from identity | [src/routes/research/ResearchPage.tsx](/Users/nick/Developer/Facet/src/routes/research/ResearchPage.tsx:388) | `inferSearchProfileFromIdentity` | `research.profile-inference` | `haiku` | Claude Haiku 4.5 | `timeoutMs: 45000`, temp inherits `0.3` |
| Research: execute live search | [src/routes/research/ResearchPage.tsx](/Users/nick/Developer/Facet/src/routes/research/ResearchPage.tsx:448) | `executeSearch` | `research.search` | `sonnet` | Claude Sonnet 4 | `temperature: 1`, `thinking_budget: 8000`, `tools: web_search_20250305`, `max_uses: 15`, request timeout `120000` |
| Pipeline: investigate job entry | [src/routes/pipeline/PipelinePage.tsx](/Users/nick/Developer/Facet/src/routes/pipeline/PipelinePage.tsx:166) | `investigatePipelineEntry` via `callSearchProxy` | `research.search` | `sonnet` | Claude Sonnet 4 | same as research search lane |
| Prep: generate interview prep | [src/routes/prep/PrepPage.tsx](/Users/nick/Developer/Facet/src/routes/prep/PrepPage.tsx:514) | `generateInterviewPrep` | `prep.generate` | `sonnet` | Claude Sonnet 4 | `timeoutMs: 90000`, temp inherits `0.3` |
| Prep: regenerate/update interview prep | [src/routes/prep/PrepPage.tsx](/Users/nick/Developer/Facet/src/routes/prep/PrepPage.tsx:592), [src/routes/prep/PrepPage.tsx](/Users/nick/Developer/Facet/src/routes/prep/PrepPage.tsx:1031) | `generateInterviewPrep` | `prep.generate` | `sonnet` | Claude Sonnet 4 | `timeoutMs: 90000`, temp inherits `0.3` |
| Letters: cover letter generation | [src/routes/letters/LettersPage.tsx](/Users/nick/Developer/Facet/src/routes/letters/LettersPage.tsx:189), [src/routes/letters/LettersPage.tsx](/Users/nick/Developer/Facet/src/routes/letters/LettersPage.tsx:251) | `generateCoverLetter` | `letters.generate` | `sonnet` | Claude Sonnet 4 | `timeoutMs: 45000`, temp inherits `0.3` |
| LinkedIn: profile generation | [src/routes/linkedin/LinkedInPage.tsx](/Users/nick/Developer/Facet/src/routes/linkedin/LinkedInPage.tsx:109) | `generateLinkedInProfile` | `linkedin.generate` | `sonnet` | Claude Sonnet 4 | `timeoutMs: 45000`, temp inherits `0.3` |
| Debrief: report generation | [src/routes/debrief/DebriefPage.tsx](/Users/nick/Developer/Facet/src/routes/debrief/DebriefPage.tsx:190) | `generateDebriefReport` | `debrief.generate` | `sonnet` | Claude Sonnet 4 | `timeoutMs: 45000`, temp inherits `0.3` |

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

- No current product surface explicitly requests `opus`. `opus` exists only as an allowed proxy alias right now.
- No current feature caller explicitly sets `max_tokens`; that is inherited from the proxy default unless the proxy environment overrides it.
- `research.profile-inference` and `identity.extract` each back multiple distinct product experiences, so the entitlement taxonomy is broader than the visible route taxonomy.
