# Deep Job Research — Implementation Plan

## Context

Facet users define their career as tagged, prioritized components and assemble resumes per positioning vector. This feature adds **AI-powered job search**: infer a search profile from the user's resume data, let them refine constraints/preferences, then run web searches via Claude API to find tiered job matches (1-5 Tier 1 near-perfect, 5-15 Tier 2/3). Results push directly into the Pipeline store.

This plan is designed for **agent handoff** — it is self-contained with full type definitions, function signatures, system prompts, and test cases.

---

## Architecture: Three-Layer Data Model

| Layer | Purpose | Persistence |
|---|---|---|
| **SearchProfile** | Stable user data: skills catalog, constraints, vectors, preferences | Zustand persisted store |
| **SearchRequest** | Per-search params: focus vectors, salary override, geo expand | Persisted in store |
| **SearchRun** | Execution output: tiered results, search log, status | Persisted in store |

---

## Files to Create/Modify

| File | Action | Description |
|---|---|---|
| `src/types/search.ts` | CREATE | Domain types: SearchProfile, SearchRequest, SearchRun, SearchResultEntry, SkillCatalogEntry, etc. |
| `src/store/searchStore.ts` | CREATE | Zustand persisted store (`facet-search-data`) with profile/request/run CRUD |
| `src/utils/searchProfileInference.ts` | CREATE | AI inference: resume data → SearchProfile (skills, vectors, work summary, open questions) |
| `src/utils/searchExecutor.ts` | CREATE | AI search: profile + request → tiered results via `web_search` tool |
| `src/routes/research/ResearchPage.tsx` | CREATE | Three-tab page: Profile Editor, Search Launcher, Results Viewer |
| `src/routes/research/research.css` | CREATE | Route styles using design system CSS custom properties |
| `src/test/searchStore.test.ts` | CREATE | Store unit tests |
| `src/test/searchProfileInference.test.ts` | CREATE | Normalizer/prompt builder unit tests |
| `proxy/server.js` | MODIFY | Add `tools` passthrough to destructure + params object |
| `src/router.tsx` | MODIFY | Register `/research` route |
| `src/components/AppShell.tsx` | MODIFY | Add Research nav item with `Search` icon from lucide |

---

## Implementation Steps

### Step 1 — Types: `src/types/search.ts`

All domain types. Key types:

- `SkillCatalogEntry` — name, category (13 categories), depth (expert/strong/working/basic/avoid), context, searchSignal
- `VectorSearchConfig` — links to ResumeVector.id, priority, description, targetRoleTitles, searchKeywords
- `SearchProfile` — skills[], vectors[], workSummary[], openQuestions[], constraints (comp/location/clearance/companySize), filters (prioritize/avoid), interviewPrefs (strongFit/redFlags), `inferredFromResumeVersion`
- `SearchRequest` — focusVectors[], companySizeOverride, salaryAnchorOverride, geoExpand, customKeywords, excludeCompanies (auto-populated from pipeline), maxResults per tier
- `SearchResultEntry` — tier (1/2/3), company, title, url, matchScore (0-100), matchReason, vectorAlignment, risks, estimatedComp, source
- `SearchRun` — requestId, status (pending/running/completed/failed), results[], searchLog[], error, tokenUsage

### Step 2 — Store: `src/store/searchStore.ts`

Follow `pipelineStore.ts` pattern exactly. State: `profile: SearchProfile | null`, `requests: SearchRequest[]`, `runs: SearchRun[]`. Actions: `setProfile`, `updateProfile{Skills,Vectors,Constraints,Filters,InterviewPrefs}`, `clearProfile`, `add/update/deleteRequest`, `add/update/deleteRun`, `getRunsForRequest`. Persist config: `name: 'facet-search-data'`, `version: 1`, `resolveStorage`, partialize data only. ID prefixes: `sprof`, `sreq`, `srun`, `sres`, `skl`.

### Step 3 — Proxy: `proxy/server.js`

Surgical change: add `tools` to the destructured body fields and to the `params` object: `...(tools && Array.isArray(tools) ? { tools } : {})`. No other proxy changes needed.

**Current proxy destructure (line 71):**
```js
const { system, messages, temperature, max_tokens, model, thinking_budget } = body
```

**Change to:**
```js
const { system, messages, temperature, max_tokens, model, thinking_budget, tools } = body
```

**Current params object (lines 89-94):**
```js
const params = {
  model: resolvedModel,
  max_tokens: max_tokens ?? DEFAULT_MAX_TOKENS,
  system: system || undefined,
  messages,
}
```

**Add after `messages`:**
```js
...(tools && Array.isArray(tools) ? { tools } : {}),
```

### Step 4 — Profile Inference: `src/utils/searchProfileInference.ts`

- `inferSearchProfile(resumeData, endpoint)` → `Pick<SearchProfile, 'skills' | 'vectors' | 'workSummary' | 'openQuestions'>`
- Copy `callLlmProxy` + `extractJsonBlock` from `prepGenerator.ts`. Timeout: 45s. No tools/thinking needed.
- System prompt: career positioning expert, extract skills with depth assessment, vector configs, work summaries, open questions. JSON only.
- User prompt: serialize resume data (meta, vectors, target_lines, profiles, skill_groups, roles with bullets, projects, education, certifications)
- `normalizeInferredProfile()` validates shape, filters invalid entries, assigns `createId('skl')` to skills, validates vectorIds exist in resume
- Export `normalizeInferredProfile` and `buildInferencePrompt` for testability

### Step 5 — Search Executor: `src/utils/searchExecutor.ts`

- `executeSearch(profile, request, endpoint)` → `{ results: SearchResultEntry[], searchLog: string[] }`
- Timeout: 120s. Uses `web_search_20250305` tool with `max_uses: 15`, `temperature: 1`, `thinking_budget: 8000`, model: `sonnet`
- Custom `callSearchProxy` that parses Anthropic tool_use content blocks, extracting text output and search query log
- System prompt: strategic job search expert, search boards (LinkedIn, Greenhouse, Lever, Ashby, careers pages), tier results by match quality
- User prompt: assembled from profile vectors, top skills, constraints, preferences, and request overrides
- `normalizeResults()` validates entries, assigns `createId('sres')`, enforces tier limits from request

### Step 6 — Route Component: `src/routes/research/ResearchPage.tsx`

Three tabs controlled by `activeTab: 'profile' | 'search' | 'results'`:

- **ProfileEditorView**: Skills table (editable depth/context), vectors config, constraints form (comp/location/clearance/companySize), filters (prioritize/avoid tag inputs), interview prefs. Empty state + stale profile warning.
- **SearchLauncherView**: Focus vectors multi-select, company size override, salary anchor, geo expand checkbox, custom keywords, auto-populated excluded companies from pipeline (rejected/withdrawn/closed). "Launch Search" button.
- **ResultsViewer**: Run selector, status indicator, search log accordion, results grouped by tier with match score badges, "Add to Pipeline" button per result.

Key handlers: `handleInfer()` → calls inference utility, creates/updates profile. `handleSearch(request)` → creates run in store, calls executor, updates run status. `handlePushToPipeline(entry, vectorId)` → maps SearchResultEntry to PipelineEntry fields.

### Step 7 — CSS: `src/routes/research/research.css`

Model after `pipeline.css`. Prefixed `.research-*` classes. Uses only CSS custom properties (`--bg-surface`, `--border-subtle`, `--text-primary`, `--accent-primary`, etc.). Tier badges: tier-1 green, tier-2 yellow, tier-3 gray.

### Step 8 — Router: `src/router.tsx`

Import `ResearchPage`, create `researchRoute` with `path: '/research'`, add to `routeTree.addChildren()`.

### Step 9 — AppShell: `src/components/AppShell.tsx`

Add `{ to: '/research' as const, icon: Search, label: 'Research' }` to `NAV_ITEMS`. Import `Search` from `lucide-react`. Position between Pipeline and Prep.

### Step 10 — Pipeline Integration (covered in Step 6)

Direct push to `usePipelineStore.addEntry()`. Map `SearchResultEntry` fields to `PipelineEntry`. Navigate to `/pipeline` after push.

### Step 11 — Tests

- `src/test/searchStore.test.ts`: Profile CRUD, request add/delete, run lifecycle, `getRunsForRequest` filtering. Model after `coverLetterStore.test.ts`.
- `src/test/searchProfileInference.test.ts`: Test `normalizeInferredProfile` — filters invalid depths, rejects unknown vectorIds, assigns skill IDs, preserves openQuestions.

---

## Sequencing & Dependency Graph

```
Step 1 (types) ──┬── Step 2 (store) ──┬── Step 6 (page) ── Step 7 (CSS)
                 │                    │         │
                 ├── Step 4 (infer) ──┘         ├── Step 8 (router)
                 │                              │
                 └── Step 5 (executor) ─────────┘   Step 9 (AppShell, after Step 8)

Step 3 (proxy) — independent, any time
Step 11 (tests) — after Steps 1 + 2
```

Recommended order: **1 → 2 → 3 → 4 → 5 → 11 → 6 → 7 → 8 → 9**

---

## Key Patterns to Follow

- **Store**: `create<State>()(persist(...))` with `createJSONStorage(resolveStorage)`, `partialize` data-only. See `src/store/pipelineStore.ts`.
- **AI proxy call**: Copy `callLlmProxy` + `extractJsonBlock` from `src/utils/prepGenerator.ts`. Use `sanitizeEndpointUrl` from `src/utils/idUtils.ts`.
- **Route component**: `isLoading` + `error` local state, async handlers called with `void handleFoo()`, error display with `role="alert"`. See `src/routes/letters/LettersPage.tsx`.
- **CSS**: All spacing via CSS custom properties, prefixed class names, no hard-coded colors. See `src/routes/pipeline/pipeline.css`.
- **TypeScript**: `verbatimModuleSyntax` — use `import type` for type-only imports.
- **IDs**: `createId(prefix)` from `src/utils/idUtils.ts`.

---

## Edge Cases

- Empty resume → sparse inference result → UI must handle empty arrays gracefully
- `web_search` timeout (120s) → run stays `'running'` until abort fires → show spinner
- 429/529 from proxy → rethrow with user-readable message
- Empty search results → show "No results found" empty state, not error
- Pipeline tier type mismatch → cast `String(entry.tier) as '1' | '2' | '3'`
- `web_search` requires `temperature: 1` — search executor already sends this
- Stale profile warning when `profile.inferredFromResumeVersion !== resumeData.version`

---

## Verification Checklist

1. `npm run typecheck` — no TypeScript errors
2. `npm run test` — all existing + new tests pass
3. `npm run dev` — Research appears in nav sidebar, tabs render
4. Profile Editor: "Build Profile from Resume" infers skills/vectors from resume data
5. Search Launcher: configure focus vectors, launch search, see results grouped by tier
6. Results Viewer: "Add to Pipeline" pushes entry to Pipeline page
7. Proxy: `curl -X POST http://localhost:9001 -H 'Content-Type: application/json' -d '{"system":"test","messages":[{"role":"user","content":"hi"}],"tools":[{"type":"web_search_20250305","name":"web_search","max_uses":1}],"temperature":1}'` succeeds

---

## Critical Reference Files

| File | What to learn from it |
|---|---|
| `src/store/pipelineStore.ts` | Zustand persist store pattern |
| `src/utils/prepGenerator.ts` | AI proxy call pattern (`callLlmProxy`, `extractJsonBlock`) |
| `src/utils/jdAnalyzer.ts` | Response envelope parsing (lines 106-129) |
| `src/routes/letters/LettersPage.tsx` | Route component pattern |
| `src/routes/pipeline/pipeline.css` | CSS pattern |
| `src/components/AppShell.tsx` | `NAV_ITEMS` array |
| `src/router.tsx` | Route registration |
| `proxy/server.js` | Proxy server (tools passthrough target) |
| `src/utils/idUtils.ts` | `createId`, `sanitizeEndpointUrl` |
| `src/types.ts` | Core domain model (`ResumeData`, `ResumeVector`, etc.) |
