---
id: TASK-153
title: 'Extend proxy to support Task Budgets, betas header, and higher max_tokens'
status: To Do
assignee: []
created_date: '2026-04-19 06:01'
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
- [ ] #1 Proxy passes output_config object through to Anthropic API body when present
- [ ] #2 Proxy sends anthropic-beta header derived from client betas array (comma-joined)
- [ ] #3 Proxy allows max_tokens up to 128000 for research.deep-search and research.thesis feature keys
- [ ] #4 Proxy accepts web_search_20260209 tool type
- [ ] #5 Verified: web_search_20260209 and task-budgets-2026-03-13 beta are actually available on the upstream Anthropic account at build time. If not, document the fallback version (e.g., web_search_20250305) and update client defaults accordingly. Record verification date in task notes.
- [ ] #6 Client-side proxy helper accepts optional output_config, betas, and max_tokens parameters
- [ ] #7 Existing proxy features (model resolution, thinking_budget, tools, auth) continue working unchanged
- [ ] #8 Tests cover new parameter passthrough with mock Anthropic responses
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
