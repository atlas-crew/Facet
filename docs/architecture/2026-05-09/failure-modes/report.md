---
mode: failure-modes
date: 2026-05-09
scope: Facet user flow (Identity/Extraction → Search → Pipeline → Prep → Letters/Resume/Recruiter)
diagram: failures.mmd
secondary_diagrams: []
synthesized_share: 0.000
---

# Failure Modes

## Summary

Failure handling concentrates in five clusters: **LLM proxy errors** (FacetAiProxyError taxonomy with 4xx/429/529 categorization), **LLM JSON parse failures** (JsonExtractionError with two kinds — empty-sentinel and no-json-found), **persistence failures** (offline-vs-error split via FacetApiError), **Typst worker failures** (no retry; old preview retained on error), and **silent degradations** (jdParser never throws; preset cancel suppressed; pipeline JD analysis errors are per-entry, not page-level).

The **headline architectural decision is no automatic retry at the proxy boundary**. Caller-side retries are rare: only `[F-13]` jobMatch's 2-attempt loop and `[F-41]` deep-research's poll-on-error pattern. Everything else surfaces failures up to UI catches that show user-facing errors. The bet: explicit retry decisions are clearer than embedded retry policies that hide failures.

The **persistence error model is binary**: every backend failure resolves through `[F-23] resolvePersistenceFailurePhase`, which collapses to either `offline` (FacetApiError code='offline') or generic `error`. Both `AbortError` and `TypeError` (network) wrap to `code='offline'` — a deliberate choice in `[F-21]` and `[F-22]` to give the user a recoverable signal rather than a hard failure.

The **Typst worker has no retry path at all** (verified by absence-claim grep). The compensating design: render errors keep the previous preview rendered (`[F-30]` keeps the old blob URL) — see comment at `usePdfPreview.ts:70`. This avoids blank-screen flashes during transient render failures.

## Callouts

| ID | Label | Citation | Confidence |
|----|-------|----------|------------|
| F-1 | FacetAiProxyError class | src/utils/aiProxyErrors.ts:31 | high |
| F-2 | FacetApiError class | src/utils/facetApiErrors.ts:10 | high |
| F-3 | readAiProxyError categorizer | src/utils/aiProxyErrors.ts:106 | high |
| F-4 | rate-limit classification (429) | src/utils/aiProxyErrors.ts:177 | high |
| F-5 | overload classification (529 / 5xx temp) | src/utils/aiProxyErrors.ts:189 | high |
| F-6 | JsonExtractionError class | src/utils/llmProxy.ts:43 | high |
| F-7 | callLlmProxy AbortError → timeout msg | src/utils/llmProxy.ts:282 | high |
| F-8 | JsonExtractionError kind='empty-sentinel' | src/utils/llmProxy.ts:147 | high |
| F-9 | JsonExtractionError kind='no-json-found' | src/utils/llmProxy.ts:154 | high |
| F-10 | prepGenerator JSON catch | src/utils/prepGenerator.ts:1931 | high |
| F-11 | coverLetterGenerator JSON catch | src/utils/coverLetterGenerator.ts:404 | high |
| F-12 | thesisGenerator wraps JsonExtractionError | src/utils/thesisGenerator.ts:650 | high |
| F-13 | jobMatch 2-attempt retry loop | src/utils/jobMatch.ts:1266 | high |
| F-14 | usePdfPreview.onerror — no retry | src/hooks/usePdfPreview.ts:40 | high |
| F-15 | typst.worker error frame | src/engine/typst.worker.ts:36 | high |
| F-16 | typst.worker missing-template guard | src/engine/typst.worker.ts:8 | high |
| F-17 | unknown templateId → fallback DEFAULT | src/hooks/usePdfPreview.ts:103 | high |
| F-18 | snapshot version mismatch throw | src/persistence/validation.ts:348 | high |
| F-19 | research_budget_exceeded handler | src/routes/research/ResearchPage.tsx:2506 | high |
| F-20 | ai_capability_unavailable handler | src/routes/research/ResearchPage.tsx:2517 | high |
| F-21 | toFacetApiError AbortError → 'offline' | src/utils/facetApiErrors.ts:89 | high |
| F-22 | toFacetApiError TypeError → 'offline' | src/utils/facetApiErrors.ts:96 | high |
| F-23 | resolvePersistenceFailurePhase | src/persistence/coordinator.ts:122 | high |
| F-24 | coordinator bootstrap catch | src/persistence/coordinator.ts:328 | high |
| F-25 | coordinator save catch | src/persistence/coordinator.ts:385 | high |
| F-26 | missing mergeImportedSnapshot | src/persistence/coordinator.ts:402 | high |
| F-27 | IndexedDB open failure | src/persistence/indexedDb.ts:48 | high |
| F-28 | IndexedDB transaction abort | src/persistence/indexedDb.ts:87 | high |
| F-29 | IndexedDB unavailable | src/persistence/indexedDb.ts:25 | high |
| F-30 | fallback to localStorage | src/persistence/indexedDb.ts:240 | high |
| F-31 | save AbortError → false | src/persistence/fileSystemAccess.ts:95 | high |
| F-32 | open AbortError → null | src/persistence/fileSystemAccess.ts:123 | high |
| F-33 | browser capability guard (showSaveFilePicker) | src/persistence/fileSystemAccess.ts:82 | high |
| F-34 | backup parseEnvelope invalid JSON | src/persistence/backupBundle.ts:96 | high |
| F-35 | AES-GCM decrypt failure | src/persistence/backupBundle.ts:197 | high |
| F-36 | WebCrypto unavailable | src/persistence/backupBundle.ts:35 | high |
| F-37 | normalizeWorkspaceSnapshot silent backfill | src/persistence/normalization.ts:89 | high |
| F-38 | exhaustive artifact type check | src/persistence/validation.ts:336 | high |
| F-39 | research activeThesisId referential integrity | src/persistence/validation.ts:317 | high |
| F-40 | cover letter conflict → console.warn skip | src/persistence/workspaceImportMerge.ts:82 | high |
| F-41 | research poll error continues polling | src/routes/research/ResearchPage.tsx:1389 | high |
| F-42 | getResearchJobPollDelay backoff | src/utils/deepSearchClient.ts:57 | high |
| F-43 | streamDeepResearchJob abort suppression | src/utils/deepSearchClient.ts:167 | high |
| F-44 | WorkspaceBackupDialog catch-all | src/components/WorkspaceBackupDialog.tsx:175 | high |
| F-45 | PresetSaveCanceledError class | src/hooks/usePresets.ts:28 | high |
| F-46 | preset cancel suppressed | src/hooks/usePresets.ts:221 | high |
| F-47 | importResumeConfig parse wrap | src/engine/serializer.ts:813 | high |
| F-48 | jdParser never throws — silent degradation | src/utils/jdParser.ts:26 | high |
| F-49 | PipelinePage per-entry analysis errors | src/routes/pipeline/PipelinePage.tsx:231 | high |
| F-50 | BuildPage density optimization failure | src/routes/build/BuildPage.tsx:1003 | high |

## Narrative

### LLM proxy error taxonomy — `[F-1] FacetAiProxyError`

`[F-3] readAiProxyError` is the central classifier. It examines the HTTP response and the error message body, producing a `FacetAiProxyError` with one of: `ai_rate_limited` (429 or message-match), `ai_overloaded` (529 or 5xx + temporary-capacity message), `research_budget_exceeded`, `ai_capability_unavailable`. Two routes have specific handlers: `[F-19]` for budget exceeded, `[F-20]` for capability unavailable (with `reason='opus_unavailable'` as a sub-discriminator). Other generators just bubble the error to the user.

`[F-7]` is the AbortError-to-timeout transformation in `callLlmProxy`. The 30s default is in `llmProxy.ts:209`; searchExecutor uses 120s.

### JSON parse failure handling

`[F-6] JsonExtractionError` carries a discriminator `kind`:
- `[F-8]` `empty-sentinel`: `<result></result>` tags present but body empty
- `[F-9]` `no-json-found`: no sentinel, no fenced block, no balanced braces

Three generators have specific handlers: `[F-10]` prepGenerator, `[F-11]` coverLetterGenerator, `[F-12]` thesisGenerator. They distinguish the typed parse error (re-throw) from generic parse errors (wrap with a user-facing message). thesisGenerator additionally wraps with a friendlier message: "Generated search thesis response was malformed. Try regenerating the thesis."

### Retry: where it does and doesn't exist

**Retry exists in two places:**
- `[F-13]` jobMatch's 2-attempt loop wrapping callLlmProxy
- `[F-41]` research poll loop continues on transient errors with `[F-42]` stepped backoff

**Retry does NOT exist for:**
- Typst worker render failures (`[F-14]` confirmed by absence-claim grep — no retry/backoff in `src/engine/` or `src/hooks/usePdfPreview.ts`)
- callLlmProxy itself (transient errors throw to caller; only jobMatch wraps)
- IndexedDB transaction failures (rejection bubbles up)

The Typst-no-retry choice is mitigated by `[F-30]` (preserve old preview on error) and `[F-17]` (fall back to DEFAULT_TEMPLATE_ID on unknown template). Render correctness is preserved differently — by not blanking — rather than by retrying.

### Persistence error binarization

`[F-21]` AbortError → `FacetApiError` `code='offline'`. `[F-22]` TypeError (network failure) → same. Everything in the persistence path that fails routes through `[F-23] resolvePersistenceFailurePhase` to either `phase='offline'` or `phase='error'`. UI consumers can show different messaging for each.

`[F-24]` and `[F-25]` are the catches in coordinator: bootstrap and save. Both set the failure phase, record `lastError`, and re-throw. The state machine update is the side effect; the throw is what the caller sees.

`[F-29]` IndexedDB-unavailable + `[F-30]` localStorage fallback: this means even a hostile browser environment that blocks IndexedDB still gets a working app with smaller persistence capacity.

### Silent degradations (where the system chooses to swallow failure)

`[F-37]` normalizeWorkspaceSnapshot silently backfills missing artifacts (linkedin/recruiter/debrief/jdAnalysis) with empty payloads. This handles the schema-evolution case where an older snapshot lacks newer artifact types.

`[F-40]` workspaceImportMerge skips a cover letter if the local pipeline entry already has one — `console.warn` only, no error. Import doesn't fail the user's local state.

`[F-48]` jdParser **never throws**. It returns empty strings for unparseable fields. JD parsing is best-effort; the user can edit fields after.

`[F-49]` PipelinePage stores JD analysis errors per-entry in a map rather than as a page-level error. One bad analysis doesn't break the whole pipeline view.

`[F-50]` BuildPage density optimization failures show a notice but don't propagate. Density optimization is opportunistic; if the LLM call fails, the resume is unchanged.

### File System Access — user cancel is not a failure

`[F-31]` and `[F-32]` distinguish AbortError (user pressed Cancel in the file picker) from real errors. AbortError returns `false`/`null`; real errors re-throw. `[F-33]` is the browser capability guard — Safari historically lacked these APIs.

### Backup integrity

`[F-34]` invalid JSON → `'Backup file is not valid JSON.'`. `[F-35]` AES-GCM decrypt failure → `'Passphrase is incorrect or the backup file is corrupted.'` (single message; doesn't distinguish wrong passphrase from tampering — appropriate for end users). `[F-36]` WebCrypto missing → hard fail.

### `[F-26]` is a contract guard, not a failure path

`importWorkspaceSnapshot` with `mode='merge'` throws if `mergeImportedSnapshot` isn't configured. This is a developer error guard, not a runtime failure mode — but it's worth keeping in the diagram because misconfiguring the runtime can manifest at import time.

## Verification log

### Discarded findings

None — every error class, catch site, and retry citation resolved at the claimed line.

### Synthesized cap

- Synthesized share: 0/50 = 0%. All failure paths cite specific lines.

### Absence claims

- `[F-14]` "no retry on Typst worker render failure" — subagent provided grep evidence, orchestrator independently re-grepped `retry|backoff` across `src/engine/` and `src/hooks/usePdfPreview.ts` and confirmed empty. **Absence claim survives.**

### Unverified citations

- Specific line offsets within long files (e.g., `coverLetterGenerator.ts:404`, `jobMatch.ts:1266` was sample-verified; thesisGenerator.ts:650, prepGenerator.ts:1931 trusted from subagent evidence). Catch sites in long generator files were not all individually deep-read; jobMatch's retry loop was sample-verified at line 1266.

## Open questions

- The asymmetry between `[F-13]` jobMatch having retry and other LLM callers not having retry — is this principled (some calls are idempotent, others aren't?) or accidental? Worth a deliberate review.
- `[F-30]` "preserve old preview on render error" depends on the previous preview not being garbage-collected. If the user navigates away and back, the cached blob URL is gone — first-render-after-navigation has no fallback. Is that bug or feature?
- `[F-37]` silent backfill of missing artifacts handles schema *additions* gracefully; what about schema *renames* or field-type changes? Need to inspect `validation.ts` migration logic.
- The deep-research `[F-41]` keeps polling on error indefinitely (with `[F-42]` capped at 30s intervals). Is there a max-attempts circuit breaker, or does the user have to abort manually?
