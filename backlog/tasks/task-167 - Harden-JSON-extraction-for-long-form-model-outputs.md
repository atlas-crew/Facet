---
id: TASK-167
title: Harden JSON extraction for long-form model outputs
status: Done
assignee: []
created_date: '2026-04-19 09:30'
updated_date: '2026-04-20 05:55'
labels:
  - search-redesign
  - robustness
  - parsing
milestone: m-20
dependencies: []
references:
  - src/utils/searchExecutor.ts
  - src/utils/prepGenerator.ts
documentation:
  - 'backlog doc-24: Key Risks section'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`extractJsonBlock()` in `src/utils/searchExecutor.ts` extracts JSON from model output using two strategies in order: (1) first ```` ```json ``` ```` fenced block, (2) first `{` to last `}`. That works for short, well-formed responses but degrades as outputs grow longer and more reasoning-heavy.

Risks with the new reasoning-layer designs:
- Extended thinking (15K-10K tokens) surfaces reasoning prose that commonly contains `{` and `}` characters (code examples, set notation, pseudo-JSON snippets)
- `candidateEdge`, `executiveSummary`, `narrative`, and `searchApproach` are all prose with quoted examples — any stray brace in prose can confuse first-brace/last-brace extraction
- Phase 2 with `max_tokens: 128000` produces responses where the structured JSON may live far from either end of the text

**Fix strategy:**

1. **Primary: explicit sentinel tags in the prompt contract**
   - Instruct the model to wrap its final structured output with a known sentinel:
     ```
     <result>
     { ... JSON here ... }
     </result>
     ```
   - Extraction first tries `<result>...</result>`, then falls back to existing strategies for backward compatibility

2. **Secondary: prefer specific content blocks in the Anthropic response**
   - When the proxy returns `content: [{ type: 'text', text: ... }, ...]`, search only `text` blocks (not `thinking` or `tool_use` blocks) for the sentinel
   - If the model uses a final `text` block for the result JSON, parse just that block

3. **Tertiary: existing first-fenced-json → first-brace-to-last-brace fallback**
   - Kept for backward compatibility with any prompts not yet updated

4. **Validation and repair:**
   - If parsing fails, log the first ~500 and last ~500 characters of the response for diagnosability
   - Classify failure mode (no sentinel, malformed JSON inside sentinel, truncated output) for telemetry
   - Do not attempt auto-repair — surface the error and let the UI offer regeneration

**Prompt changes:**
- Update `buildSearchPrompt()` (and equivalent in thesis generator, prepGenerator) to instruct sentinel wrapping
- Example instruction: "Wrap your final JSON output with `<result>` and `</result>` tags on their own lines. All reasoning, narrative, and prose may appear outside these tags."

**Tests:**
- JSON wrapped in sentinel tags — primary path
- JSON in ```` ```json ``` ```` fenced block (legacy path) — backward compatible
- JSON bare (first-brace/last-brace) — backward compatible
- JSON inside prose with stray braces — sentinel disambiguates
- Multiple content blocks where only one has the result — text-block selection works
- Truncated response — clean failure with diagnostic logging
- Sentinel present but invalid JSON inside — clean failure
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 extractJsonBlock() tries sentinel tags <result>...</result> before existing strategies
- [ ] #2 Sentinel-based extraction works when JSON is surrounded by prose with stray braces
- [ ] #3 Existing tests pass — fenced blocks and bare JSON still parse correctly
- [ ] #4 Thesis generator prompt instructs sentinel wrapping
- [ ] #5 Deep research prompt instructs sentinel wrapping
- [ ] #6 Prep generator prompt instructs sentinel wrapping (consistency across the codebase)
- [ ] #7 Parse failures log first/last 500 chars of response and classify failure mode
- [ ] #8 Tests cover: sentinel happy path, fenced fallback, bare fallback, stray braces in prose, multi-block content, truncated response, invalid JSON in sentinel
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Hardened `extractJsonBlock` with a sentinel-first strategy and consolidated the duplicate across `llmProxy.ts` and `searchExecutor.ts`.

**Strategy order (src/utils/llmProxy.ts):**
1. **Primary:** `<result>...</result>` sentinel (non-greedy regex, inline or block form).
2. **Secondary:** ` ```json ... ``` ` fenced block — unchanged.
3. **Tertiary:** first-brace to last-brace — unchanged.

**Failure classification:**
- `JsonExtractionError.kind` — `'no-json-found' | 'empty-sentinel'`.
- `JsonExtractionError.diagnostic` — `{ head, tail, length }`; head is first 500 chars, tail is last 500 (omitted when input fits in head), length is full input size.
- `console.warn` logs diagnostic on every failure path.

**Consolidation:**
- `searchExecutor.ts` previously had a duplicate `extractJsonBlock` + `JsonExtractionError`. Now imports + re-exports from `llmProxy.ts` so both code paths share one hardened implementation. Module surface is unchanged for callers.

**Prompt updates:**
- `buildSearchPrompt` (searchExecutor) — instructs model to wrap final JSON with `<result>...</result>` tags on their own lines, with an example.
- `prepGenerator` system prompt — same instruction.
- Thesis generator + deep research prompts land in TASK-151.1 and TASK-151.2 respectively; those will pick up the sentinel contract when built.

**Error re-throw sites fixed:**
- `identityExtraction.ts` and `identityParametersGeneration.ts` re-throw with context prefix — now forward the original `kind` and `diagnostic` so classification survives the re-throw.

**Tests added (16 in src/test/llmProxyExtractJson.test.ts):**
- Sentinel happy path (block + inline forms).
- Sentinel disambiguation with stray braces in surrounding prose.
- Empty-sentinel classification.
- Sentinel vs fenced priority.
- Fenced fallback + whitespace trimming.
- Brace-scan fallback with nested braces.
- No-json-found classification.
- Diagnostic head/tail/length for long and short inputs.
- `console.warn` logging on both failure modes.
- Strategy priority order (sentinel → fenced → braces).

One existing test in `identityParametersGeneration.test.ts` was adjusted to match the expanded error message. Commit: `b663663`.

Stats: 1293 → 1309 tests (+16). Typecheck + lint clean. Pre-existing `searchExecutor.test.ts:405` proxy-error flake (unrelated) remains the only failure.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
