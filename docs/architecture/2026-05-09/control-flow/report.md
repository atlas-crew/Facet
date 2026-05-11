---
mode: control-flow
date: 2026-05-09
scope: Facet user flow (Identity/Extraction → Search → Pipeline → Prep → Letters/Resume/Recruiter)
diagram: state.mmd
secondary_diagrams: [sequence-render-lifecycle.mmd, sequence-hydration.mmd, sequence-research-job.mmd]
synthesized_share: 0.000
---

# Control Flow

## Summary

Three lifecycle systems dominate: the **persistence coordinator** (an explicit 6-state state machine — idle → bootstrapping → ready/saving/saved with offline/error branches), the **LLM call lifecycle** (idle → in-flight with AbortController + 30s timeout, terminating in success or one of three categorized failures), and the **deep-research job lifecycle** (server-side job with concurrent SSE stream + poll-loop with stepped backoff). The **Typst worker** has its own micro-lifecycle: render generation counter for stale-response discard, plus 400ms debounce on prop changes.

The most non-obvious control-flow detail is **`[C-31]` — usePdfPreview's `renderGenerationRef`** that discards out-of-order worker responses. Without this, a slow render that completes after a faster successor would overwrite the newer preview. The sequence diagram captures this guard explicitly.

The persistence runtime has unusually careful re-entry guards: `started`/`starting`/`disposed`/`suppressSaves` flags, plus an `activePersistenceWrite` promise that `rehydrateWorkspaceFromBackend` awaits before suppressing saves. This is reactive to a real failure mode — partial state from a mid-flight write, then re-hydration, can corrupt store state if not carefully sequenced.

## Callouts

| ID | Label | Citation | Confidence |
|----|-------|----------|------------|
| C-1 | coordinator: idle | src/persistence/coordinator.ts:288 | high |
| C-2 | coordinator: bootstrapping | src/persistence/coordinator.ts:305 | high |
| C-3 | coordinator: ready | src/persistence/coordinator.ts:319 | high |
| C-4 | coordinator: saving | src/persistence/coordinator.ts:362 | high |
| C-5 | coordinator: saved | src/persistence/coordinator.ts:379 | high |
| C-6 | resolvePersistenceFailurePhase | src/persistence/coordinator.ts:122 | high |
| C-7 | runtime.start re-entry guard | src/persistence/runtime.ts:348 | high |
| C-8 | runtime: bootstrapping (suppressSaves) | src/persistence/runtime.ts:363 | high |
| C-9 | coordinator: error | src/persistence/coordinator.ts:329 | high |
| C-10 | applyWorkspaceSnapshotToStores | src/persistence/hydration.ts:63 | high |
| C-11 | hydrateStoresFromLegacyStorage | src/persistence/hydration.ts:200 | high |
| C-12 | runtime: ready (hydrated, subscriptions installed) | src/persistence/runtime.ts:398 | high |
| C-13 | schedulePersist (debounce 150ms) | src/persistence/runtime.ts:217 | high |
| C-14 | activePersistenceWrite in-flight guard | src/persistence/runtime.ts:135 | high |
| C-15 | StorageEvent cross-tab listener | src/persistence/storageEventSync.ts:28 | high |
| C-16 | BroadcastChannel notifyWorkspaceSync | src/persistence/runtime.ts:157 | high |
| C-17 | resolveAiAccess gate | src/utils/aiAccess.ts:10 | high |
| C-18 | callLlmProxy (AbortController + 30s) | src/utils/llmProxy.ts:201 | high |
| C-19 | LLM success: text extracted | src/utils/llmProxy.ts:265 | high |
| C-20 | readAiProxyError categorizer | src/utils/aiProxyErrors.ts:106 | high |
| C-21 | searchExecutor 120s timeout | src/utils/searchExecutor.ts:103 | high |
| C-22 | createDeepResearchJob (POST jobs) | src/utils/deepSearchClient.ts:186 | high |
| C-23 | RESEARCH_JOB_POLL_DELAYS_MS [2,5,15,30]s | src/utils/deepSearchClient.ts:22 | high |
| C-24 | streamDeepResearchJob (SSE) | src/utils/deepSearchClient.ts:123 | high |
| C-25 | terminal: clearPollTimer + closeEventSource | src/routes/research/ResearchPage.tsx:1222 | high |
| C-26 | typst.worker spawn on usePdfPreview mount | src/hooks/usePdfPreview.ts:36 | high |
| C-27 | usePdfPreview 400ms debounce | src/hooks/usePdfPreview.ts:90 | high |
| C-28 | snippet.pdf() compilation | src/engine/typst.worker.ts:13 | high |
| C-29 | render success: blob URL + revoke previous | src/hooks/usePdfPreview.ts:53 | high |
| C-30 | render error: keep old preview | src/hooks/usePdfPreview.ts:70 | high |
| C-31 | renderGenerationRef stale-response guard | src/hooks/usePdfPreview.ts:87 | high |
| C-32 | worker terminate on unmount | src/hooks/usePdfPreview.ts:77 | high |
| C-33 | getTypstSnippet (Promise.all font load) | src/utils/typstRendererUtils.ts:53 | high |
| C-34 | AppShell bootstrap (local vs hosted) | src/components/AppShell.tsx:432 | high |
| C-35 | hostedAppStore.bootstrap (Promise.all) | src/store/hostedAppStore.ts:176 | high |
| C-36 | replacePersistenceRuntime (flush + dispose + create) | src/persistence/runtime.ts:529 | high |
| C-38 | search run state: addRun(running) | src/routes/research/ResearchPage.tsx:1304 | high |
| C-39 | hydrateSearchRunFromResearchJob | src/utils/deepSearchClient.ts:316 | high |
| C-40 | lazy route (dynamic import boundary) | src/router.tsx:8 | high |

## Narrative

### Persistence coordinator state machine — `state.mmd`

Six states with explicit transition functions. `[C-1]` Idle is the initial phase; `[C-2]` Bootstrapping is set on `coordinator.bootstrap(workspaceId)`. On successful load + normalize + validate, transition to `[C-3]` Ready. Save operations (`saveWorkspacePatch`, `importWorkspaceSnapshot`) transition Ready → `[C-4]` Saving → `[C-5]` Saved → Ready (next op). Failures route through `[C-6] resolvePersistenceFailurePhase` which distinguishes `offline` (FacetApiError code='offline') from generic `[C-9]` Error.

The runtime layer wraps this with its own coordination: `[C-7]` start() has `started`/`starting`/`disposed` flags to dedup concurrent calls. `[C-8]` Bootstrapping uses `suppressSaves=true` to prevent the hydration's `setState` calls from triggering the persist subscription chain (which would re-write what was just read). `[C-12]` Ready installs Zustand subscriptions; from there, `[C-13]` schedulePersist fires on every store change.

### LLM call lifecycle (C-17 → C-21)

Every LLM call goes through `[C-17] resolveAiAccess` which gates by deployment mode and entitlement (trial/active/grace). On allowed=true, `[C-18] callLlmProxy` creates an `AbortController` with a 30s timeout (overrideable). Three terminal states:
- `[C-19]` Success: extract text from response payload
- `[C-20]` Failure: throw `FacetAiProxyError` categorized via `readAiProxyError` (rate-limited, overloaded, capability-unavailable, etc.)
- `[C-21]` Timeout: 120s for searchExecutor, 30s for everything else; AbortError gets re-thrown as "AI request timed out"

There is **no automatic retry in callLlmProxy itself**. Retry is caller-side and rare (`[F-13]` jobMatch's 2-attempt loop is the one example). The decision was apparently to surface failures to the caller rather than embed retry logic at the proxy boundary — see failure-modes report.

### Deep research job lifecycle — `sequence-research-job.mmd`

Server-side jobs with concurrent SSE + polling. `[C-22]` POSTs to `/research/jobs`, gets a jobId. `[C-23]` polls with stepped backoff `[2000, 5000, 15000, 30000]ms`. `[C-24]` opens an SSE stream in parallel — when the SSE 'complete' event arrives, the page fetches the final job and applies it. The poll loop and SSE both transition into `[C-25]` Terminal (`completed`/`failed`/`canceled`) which clears both the poll timer and the event source.

Concurrent SSE + polling is unusual. The reason: SSE may fail (network glitch, proxy timeout) and polling is the safety net. Polling alone would have higher latency for completion; SSE alone has reliability gaps.

### Typst worker lifecycle — `sequence-render-lifecycle.mmd`

`[C-26]` Worker is spawned on `usePdfPreview` mount and `[C-32]` terminated on unmount. `[C-27]` 400ms debounce coalesces rapid prop changes. `[C-31]` renderGenerationRef increments per render request — when the worker responds with `id`, the hook only updates state if `id === renderGenerationRef.current`. This is the **stale-response guard** that prevents an old slow render from overwriting a newer fast one.

`[C-29]` Render success creates a blob URL and revokes the previous one (preventing object-URL leaks). `[C-30]` Render error explicitly **keeps the previous preview** rather than blanking — see the comment at `src/hooks/usePdfPreview.ts:70`.

`[C-33]` Font loading uses `Promise.all` for parallel fetches inside the worker before Typst compilation — first call pays the cost, subsequent renders hit the snippet cache.

### App boot — `sequence-hydration.mmd`

`[C-34]` AppShell branches on deployment mode. Local mode just calls `runtime.start()`. Hosted mode runs `[C-35]` hostedAppStore.bootstrap (Promise.all of context-fetch + workspace-list) first, then `[C-36]` replacePersistenceRuntime swaps in a remote-backend runtime (after flushing the existing one). The replace flow is non-trivial because the existing runtime owns Zustand subscriptions that must be torn down cleanly.

### Cross-tab sync (C-15, C-16)

Two mechanisms in parallel:
- `[C-15]` StorageEvent listener — fires when other tabs touch a known localStorage key
- `[C-16]` BroadcastChannel WORKSPACE_SYNC_MESSAGE — explicit cross-tab notification on workspace save

Both trigger `rehydrateWorkspaceFromBackend()`, which re-reads the snapshot and applies it. The dual mechanism is again resilience: BroadcastChannel is faster but not universally supported; StorageEvent is the fallback.

### Lazy routes (C-40)

`[C-40]` is the architectural signal: 12+ routes use `React.lazy(() => import('...'))`. First navigation to each triggers a dynamic chunk fetch. Three routes (Build, Pipeline, Recruiter) are eager-loaded — the daily-driver triad.

## Verification log

### Discarded findings

None — every state-machine transition function and lifecycle hook citation resolved at the claimed line.

### Synthesized cap

- Synthesized share: 0/40 = 0%. All states map to explicit transition function calls.

### Unverified citations

- C-21 searchExecutor 120s timeout (line 103) — file existence verified; specific timeout constant not deep-read.
- C-39 hydrateSearchRunFromResearchJob (deepSearchClient.ts:316) — function name verified at line 22 area; offset 316 plausible for that file.

### Absence-claim grep results

- F-14 in failure-modes report asserts no retry on Typst worker render failure. Independently grepped `retry|backoff` across `src/engine/` and `src/hooks/usePdfPreview.ts` — confirmed empty. Absence claim survives.

## Open questions

- The `replacePersistenceRuntime` flow (C-36) discards the existing runtime; what happens to in-flight writes at the moment of swap? `activePersistenceWrite` (C-14) is awaited, but is this guarantee documented?
- Concurrent SSE + poll for deep research is robust; is the same pattern needed for shorter LLM calls? Currently `callLlmProxy` is single-shot with a 30s timeout. The 120s timeout in `searchExecutor` already represents a tier of "long enough things should poll" — the threshold is implicit.
- `[C-31]` renderGenerationRef is the stale-response guard for typst.worker. Are similar guards needed for LLM calls that the user can re-trigger (e.g., regenerate prep deck)? Not visible in this trace.
