---
mode: integrations
date: 2026-05-09
scope: Facet user flow (Identity/Extraction → Search → Pipeline → Prep → Letters/Resume/Recruiter)
diagram: boundaries.mmd
secondary_diagrams: []
synthesized_share: 0.000
---

# Integration Points

## Summary

Facet integrates with **four kinds of external systems**: (1) the Anthropic API via a local/hosted proxy (LLM calls + research jobs), (2) browser-native APIs (IndexedDB, localStorage, File System Access, Web Worker, Blob URLs, iframe), (3) the Supabase-based hosted backend (workspace persistence + auth), and (4) npm libraries that operate as in-process external code (Typst WASM, PDF.js, docx, JSZip).

The most architecturally significant boundary is the **AI proxy split**: every LLM call goes through `[X-1] aiAccess.ts` (entitlement gate) → `[X-10] callLlmProxy` (HTTP boundary) → `[X-2] Anthropic API`. There is **no direct anthropic-sdk usage** in the codebase — all calls go through this proxy boundary. That's a deliberate architectural decision: the local dev proxy lets the team test against Anthropic without exposing keys to the browser, and the hosted proxy gates entitlements on tenant context.

The **Typst worker** is a non-LLM external integration that's nearly invisible in the IA: it's a single `new Worker(...)` call in `[X-28] usePdfPreview` that connects to a WASM-compiled Typst engine. The integration surface is small (postMessage in / postMessage out), but the boundary crosses both a Web Worker process boundary and a WASM compilation boundary.

## Callouts

| ID | Label | Citation | Confidence | Class |
|----|-------|----------|------------|-------|
| X-1 | utils/aiAccess.resolveAiAccess | src/utils/aiAccess.ts:10 | high | cited |
| X-2 | Anthropic API (via proxy) | — | external | external |
| X-3 | utils/aiProxyErrors.readAiProxyError | src/utils/aiProxyErrors.ts:106 | high | cited |
| X-5 | deepSearchClient.streamDeepResearchJob | src/utils/deepSearchClient.ts:123 | high | cited |
| X-6 | research jobs SSE stream | — | external | external |
| X-7 | deepSearchClient.createDeepResearchJob | src/utils/deepSearchClient.ts:186 | high | cited |
| X-8 | research jobs POST endpoint | — | external | external |
| X-10 | utils/llmProxy.callLlmProxy | src/utils/llmProxy.ts:201 | high | cited |
| X-11 | utils/llmProxy.fetchAiProxyCapabilities | src/utils/llmProxy.ts:299 | high | cited |
| X-12 | proxy /capabilities | — | external | external |
| X-13 | persistence/indexedDb.openDatabase | src/persistence/indexedDb.ts:29 | high | cited |
| X-14 | Browser IndexedDB | — | external | external |
| X-15 | indexedDb.saveWorkspaceSnapshot | src/persistence/indexedDb.ts:163 | high | cited |
| X-16 | fileSystemAccess.saveTextFileWithPicker | src/persistence/fileSystemAccess.ts:76 | high | cited |
| X-17 | showSaveFilePicker | — | external | external |
| X-18 | fileSystemAccess.openTextFileWithPicker | src/persistence/fileSystemAccess.ts:104 | high | cited |
| X-19 | showOpenFilePicker | — | external | external |
| X-20 | persistence/remoteBackend (HTTP request) | src/persistence/remoteBackend.ts:31 | high | cited |
| X-21 | Facet hosted persistence backend | — | external | external |
| X-22 | hostedSession (Supabase auth) | src/utils/hostedSession.ts:32 | high | cited |
| X-23 | Supabase OAuth + session | — | external | external |
| X-24 | hostedAccountClient | src/utils/hostedAccountClient.ts:30 | high | cited |
| X-25 | Facet hosted account API | — | external | external |
| X-26 | engine/typst.worker | src/engine/typst.worker.ts:4 | high | cited |
| X-27 | Typst typesetting (typst-ts WASM) | — | external | external |
| X-28 | usePdfPreview worker spawn | src/hooks/usePdfPreview.ts:36 | high | cited |
| X-29 | Web Worker postMessage | — | external | external |
| X-31 | URL.createObjectURL | — | external | external |
| X-32 | components/PdfPreview iframe | src/components/PdfPreview.tsx:14 | high | cited |
| X-33 | Browser PDF viewer (iframe) | — | external | external |
| X-34 | utils/resumeScanner/pdf | src/utils/resumeScanner/pdf.ts:14 | high | cited |
| X-35 | PDF.js (pdfjs-dist) | — | external | external |
| X-36 | store/storage (Zustand persist) | src/store/storage.ts:47 | high | cited |
| X-37 | Browser localStorage | — | external | external |
| X-38 | utils/docxRenderer | src/utils/docxRenderer.ts:1 | high | cited |
| X-39 | docx library | — | external | external |
| X-40 | utils/bundleExporter | src/utils/bundleExporter.ts:1 | high | cited |
| X-41 | JSZip | — | external | external |
| X-44 | utils/facetEnv (env-var resolution) | src/utils/facetEnv.ts:56 | high | cited |
| X-45 | Vite environment variables | src/vite-env.d.ts:4 | high | external |

## Narrative

### LLM proxy boundary

Three integration shapes converge on the same proxy:

- `[X-10] callLlmProxy` — generic LLM completion (the workhorse used by every generator)
- `[X-7] createDeepResearchJob` — POST to spawn an async server-side research job
- `[X-5] streamDeepResearchJob` — SSE stream that delivers progress events for an active job
- `[X-11] fetchAiProxyCapabilities` — capability discovery (which models are available)

`[X-1] resolveAiAccess` gates all of these by entitlement (deployment mode, hosted tenant status). The `[X-3] readAiProxyError` categorizer is the inverse boundary — every error response gets parsed back into the `FacetAiProxyError` taxonomy.

The deliberate non-pattern: **no direct `import { Anthropic } from '@anthropic-ai/sdk'`** anywhere. The proxy is the contract.

### Browser persistence APIs

Three layers of browser-native persistence:

- `[X-13]/[X-15]` IndexedDB — the primary local store. Workspace snapshots, large state.
- `[X-36]` localStorage via Zustand persist — small, fast, fragment-level state. Ironically the user-facing "where state lives" perception.
- `[X-16]/[X-18]` File System Access API — explicit user-driven file save/open (workspace export/import). Behind a capability guard `[F-33]` because Safari historically didn't have it.

The `[X-29]` cross-tab `BroadcastChannel` and StorageEvent listeners (covered in control-flow C-15/C-16) are also browser-API integrations but operate as control-flow signals, not data integrations.

### Hosted backend

When deployment mode is `hosted`, three integrations come online:

- `[X-22]` Supabase auth (`supabaseClient.auth.signInWithOAuth({ provider: 'github' })`) provides the user identity
- `[X-20]` `remoteBackend` PUTs workspace snapshots to `/workspaces/:id`
- `[X-24]` `hostedAccountClient` fetches account context (entitlements, tenant info) and workspace lists

In local mode, none of these are touched. The `[X-44] facetEnv` resolver decides which mode applies based on `VITE_FACET_DEPLOYMENT_MODE` — env-var configuration is itself an integration with the build environment.

### Typst rendering — `[X-26]` + `[X-27]`

`[X-28] usePdfPreview` spawns a Web Worker pointed at `[X-26] typst.worker.ts`. Inside the worker, `getTypstSnippet` lazily loads the WASM-compiled `[X-27]` Typst engine and calls `snippet.pdf({ mainContent, inputs })`. Output is a `Uint8Array` of PDF bytes, transferred zero-copy back to the main thread (the `[bytes.buffer]` second arg to `postMessage`).

This is the only WASM integration in the codebase. The npm package `@myriaddreamin/typst-ts-web-compiler` ships the WASM binary; first call cost is ~hundreds of milliseconds, subsequent calls hit the snippet cache.

### PDF.js (`[X-35]`)

Used in two places:
- `[X-34]` resumeScanner — extracts text from uploaded PDF resumes for identity-extraction seeding
- The browser's iframe-embedded PDF viewer (`[X-32]/[X-33]`) for preview rendering

These are different uses of the same library. resumeScanner runs PDF.js in main-thread JS; the preview path uses the browser's built-in iframe PDF viewer (no JS).

### npm libraries with process-internal effects

- `[X-39]` docx — DOCX export. `utils/docxRenderer.ts` imports docx primitives and packs a Document.
- `[X-41]` JSZip — workspace bundle export. `utils/bundleExporter.ts` zips multiple workspace artifacts into one downloadable file.

These are flagged as "external" because they package external code (docx parsers, ZIP encoders) but they don't cross a process boundary in the runtime sense.

### Vite env vars

`[X-44] getFacetClientEnv` resolves the runtime config from `import.meta.env` plus build-time fallback values. The vars (`[X-45]`) are: `VITE_FACET_DEPLOYMENT_MODE`, `VITE_FACET_API_BASE_URL`, `VITE_ANTHROPIC_PROXY_URL`, `VITE_ANTHROPIC_PROXY_API_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. This is the configuration boundary — every external integration above is parameterized by one of these.

## Verification log

### Re-classification

The integrations subagent originally tagged ~17 external-system nodes as `confidence: synthesized` because no in-repo line owns the external system. Per `mermaid-conventions.md`, external systems use the `external` classDef (visually distinct, blue) — they are not *synthesized* concepts (which are dotted-bordered "no-single-owner" patterns within the codebase). Re-classified to `external` class so the synthesized cap calculation is correct.

### Discarded findings

- X-9 (prepGenerator import of llmProxy) and a few other "import statement" findings — these are IA-mode signals, not integrations. Integrations are the *call site*, not the import. Discarded; the corresponding generator import is captured in the IA report.
- X-42/X-43 (Mermaid diagram rendering in the help route) — out of user-flow scope; help/ is excluded.

### Synthesized cap

- Synthesized share: 0/40 = 0% after re-classification. External-class nodes are 19; cited-class nodes are 21.

### Unverified citations

- Specific line offsets in larger files (e.g., `llmProxy.ts:201` was deep-verified; X-3 readAiProxyError was deep-verified). X-44 facetEnv at line 56 trusted from subagent evidence (file structure consistent).

## Open questions

- Is there any direct npm-package import of `@anthropic-ai/sdk`? (Asserted absence by the proxy-boundary architectural commitment, but not grep-confirmed in this run. Worth verifying.)
- The `[X-21]` hosted persistence backend uses Bearer tokens and an optional `X-Proxy-API-Key`. Is rotation/refresh handled at this layer or in `[X-22]` hostedSession?
- Web Worker (`[X-29]`) is currently single-instance per `usePdfPreview` mount. With multiple preview surfaces (e.g., side-by-side compare), would a worker pool be needed, or does serialization through the cache suffice?
