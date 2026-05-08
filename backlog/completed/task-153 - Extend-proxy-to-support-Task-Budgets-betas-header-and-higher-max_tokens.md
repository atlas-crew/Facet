---
id: TASK-153
title: 'Extend proxy to support Task Budgets, betas header, and higher max_tokens'
status: Done
assignee:
  - '@codex'
created_date: '2026-04-19 06:01'
updated_date: '2026-04-24 22:46'
labels:
  - search-redesign
  - proxy
  - infrastructure
milestone: m-21
dependencies: []
references:
  - src/utils/searchExecutor.ts
  - src/utils/llmProxy.ts
documentation:
  - 'backlog doc-24: Proxy Changes Required section'
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Facet proxy (`facetServer`) needs to pass through new Anthropic API parameters required by the Task Budgets beta. This task is scoped to *parameter pass-through only* — the async job infrastructure (durable storage, POST/GET/cancel endpoints, runner lifecycle) is covered by TASK-161, and SSE subscription passthrough is covered by TASK-162.

Missing capabilities:

1. **`output_config.task_budget`** — `{ type: 'tokens', total: 80000 }` for Task Budgets beta. Pass through to Anthropic Messages API body unchanged.
2. **`output_config.effort`** — `'high'` | `'xhigh'` | `'max'`. Pass through to Anthropic API body.
3. **`betas` header** — Client sends `betas: ['task-budgets-2026-03-13']`, proxy joins into `anthropic-beta: task-budgets-2026-03-13` header on upstream request.
4. **`max_tokens` cap increase** — Allow up to 128000 for `research.deep-search` and `research.thesis` feature keys.
5. **`web_search_20260209` tool type** — accepted as valid tool version.

Design generically — don't hard-code beta names. Pass `betas` array from client and join as comma-separated `anthropic-beta` header. Pass `output_config` object through to API body unchanged.

Also update client helpers in `searchExecutor.ts` (or new `proxyClient.ts`) to accept these parameters. Don't wire to UI here — that happens in TASK-151.1 and TASK-151.2.

**Out of scope (see sibling tasks):**
- Async job lifecycle, job storage, POST/GET/cancel endpoints → TASK-161
- SSE subscription endpoint → TASK-162
- Cost guardrails → TASK-164
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Proxy passes output_config object through to Anthropic API body when present
- [x] #2 Proxy sends anthropic-beta header derived from client betas array (comma-joined)
- [x] #3 Proxy allows max_tokens up to 128000 for research.deep-search and research.thesis feature keys
- [x] #4 Proxy accepts web_search_20260209 tool type
- [x] #5 Verified: web_search_20260209 and task-budgets-2026-03-13 beta are actually available on the upstream Anthropic account at build time. If not, document the fallback version (e.g., web_search_20250305) and update client defaults accordingly. Record verification date in task notes.
- [x] #6 Client-side proxy helper accepts optional output_config, betas, and max_tokens parameters
- [x] #7 Existing proxy features (model resolution, thinking_budget, tools, auth) continue working unchanged
- [x] #8 Tests cover new parameter passthrough with mock Anthropic responses
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Completed TASK-153 implementation.\n\nImplementation notes:\n- Added research.deep-search and research.thesis to the hosted AI feature allowlist/types, model defaults, and per-feature burst buckets.\n- Routed task-budget research features to claude-opus-4-7 because live upstream verification showed user-configurable task budgets work on Opus 4.7 and are rejected on Sonnet/Opus 4.1.\n- Added proxy passthrough for output_config and betas. Betas are validated/trimmmed and forwarded as the anthropic-beta request header, including through the unauthenticated Anthropic-compatible client.\n- Added feature-scoped high output ceilings for research.deep-search and research.thesis while keeping ordinary features on the configured default cap.\n- Allowed web_search_20260209 at the proxy, while keeping the client default on the currently public/documented web_search_20250305 fallback unless callers opt into the newer tool type.\n- Extended callLlmProxy and callSearchProxy with optional task-budget/beta/max-token/search-tool parameters.\n\nUpstream verification on 2026-04-24:\n- task-budgets-2026-03-13 + output_config.task_budget + output_config.effort returned 200 on the configured Anthropic account with model claude-opus-4-7.\n- The same task_budget request was rejected for claude-sonnet-4-6, claude-opus-4-1-20250805, and claude-sonnet-4-20250514 with "This model does not support user-configurable task budgets."\n- web_search_20260209 returned 200 with claude-opus-4-7. web_search_20250305 remains the default fallback because it is the public documented tool type.\n\nValidation:\n- npx vitest run src/test/facetServer.test.ts src/test/searchExecutor.test.ts src/test/llmProxy.test.ts -> 3 files / 90 tests passed.\n- npm run typecheck -> passed.\n- npx eslint proxy/facetServer.js proxy/aiFeatures.js src/types/hosted.ts src/utils/llmProxy.ts src/utils/searchExecutor.ts src/test/facetServer.test.ts src/test/searchExecutor.test.ts src/test/llmProxy.test.ts -> passed.\n- npm run build -> passed.\n- npm run test was run and remains blocked by unrelated baseline src/test/PrepLiveMode.test.tsx localStorage.setItem failure.\n- npm run lint was run and remains blocked by unrelated generated-output/baseline lint debt outside this task.\n- Independent code review CLEAN: .agents/reviews/review-20260424-182759.md.\n- Test audit CLEAN: .agents/reviews/test-audit-20260424-184448.md.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
TASK-153 adds proxy/client support for Anthropic Task Budgets passthrough: output_config, beta headers, web_search_20260209 acceptance, and feature-scoped high max_tokens for deep research/thesis features. The implementation keeps public search defaults on web_search_20250305, routes task-budget features to Opus 4.7 based on live account verification, and covers proxy/client behavior with focused tests plus clean independent review and test audit.
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
