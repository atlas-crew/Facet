---
mode: data-flow
date: 2026-05-09
scope: Facet user flow (Identity/Extraction → Search → Pipeline → Prep → Letters/Resume/Recruiter)
diagram: flow.mmd
secondary_diagrams: [sequence-resume-render.mmd, sequence-pipeline-promotion.mmd, sequence-snapshot-save.mmd]
synthesized_share: 0.000
---

# Data Flow

## Summary

Six critical paths thread the user flow: **identity extraction**, **search → pipeline promotion**, **JD analysis**, **pipeline → prep**, **resume assembly + render**, **cover letter generation**, and a cross-cutting **persistence lifecycle** that catches every store mutation. Every path **terminates in a single Zustand store mutation that triggers `schedulePersist`** — that's the only persistence boundary in the system. The 150ms debounce on `schedulePersist` is the design's response to write amplification: a typing burst that fires 30 mutations costs one snapshot write.

The most architecturally significant flow is **identity → ResumeData → typst.worker** (paths D-8 through D-19). It's the only path that crosses three runtime boundaries (main thread → adapter → engine → Web Worker) and is the only place a non-LLM external system (the Typst WASM compiler) participates.

## Callouts

| ID | Label | Citation | Confidence |
|----|-------|----------|------------|
| D-1 | IdentityPage extraction handler | src/routes/identity/IdentityPage.tsx:210 | high |
| D-2 | generateIdentityDraft (callLlmProxy) | src/utils/identityExtraction.ts:1706 | high |
| D-3 | parseIdentityExtractionResponse | src/utils/identityExtraction.ts:1479 | high |
| D-4 | normalizeExtractedIdentityCandidate | src/utils/identityExtraction.ts:1349 | high |
| D-5 | mergeSeededIdentityStructure | src/utils/identityExtraction.ts:1491 | high |
| D-6 | identityStore.setDraft | src/store/identityStore.ts:771 | high |
| D-8 | applyDraft → currentIdentity | src/store/identityStore.ts:1597 | high |
| D-10 | handlePushToBuild | src/routes/identity/IdentityPage.tsx:634 | high |
| D-11 | professionalIdentityToResumeData | src/identity/resumeAdapter.ts:272 | high |
| D-12 | resumeStore.setData | src/store/resumeStore.ts:62 | high |
| D-13 | BuildPage useMemo (assembleResume call) | src/routes/build/BuildPage.tsx:558 | high |
| D-14 | engine assembleResume | src/engine/assembler.ts:194 | high |
| D-15 | engine applyPageBudget | src/engine/pageBudget.ts:151 | high |
| D-16 | usePdfPreview postMessage | src/hooks/usePdfPreview.ts:109 | high |
| D-17 | typst.worker self.onmessage | src/engine/typst.worker.ts:4 | high |
| D-18 | usePdfPreview Blob URL | src/hooks/usePdfPreview.ts:54 | high |
| D-19 | PdfPreview component | src/components/PdfPreview.tsx:6 | high |
| D-20 | ResearchPage handlePushToPipeline | src/routes/research/ResearchPage.tsx:2719 | high |
| D-21 | createPipelineEntryDraft | src/routes/research/researchUtils.ts:188 | high |
| D-22 | pipelineStore.addEntry | src/store/pipelineStore.ts:185 | high |
| D-23 | pipelineStore.entries (durable state) | src/store/pipelineStore.ts:180 | high |
| D-24 | jdAnalysisStore.upsertAnalysis | src/store/jdAnalysisStore.ts:60 | high |
| D-25 | PrepPage.createDeck call | src/routes/prep/PrepPage.tsx:960 | high |
| D-26 | prepStore.createDeck | src/store/prepStore.ts:1136 | high |
| D-28 | generateCoverLetter | src/utils/coverLetterGenerator.ts:338 | high |
| D-29 | coverLetterStore.upsertLetterForPipelineEntry | src/store/coverLetterStore.ts:47 | high |
| D-30 | schedulePersist (debounce 150ms) | src/persistence/runtime.ts:217 | high |
| D-31 | persistCurrentState | src/persistence/runtime.ts:181 | high |
| D-32 | createWorkspaceSnapshotFromStores | src/persistence/snapshot.ts:232 | high |
| D-33 | coordinator.importWorkspaceSnapshot | src/persistence/coordinator.ts:425 | high |
| D-34 | IndexedDB saveWorkspaceSnapshot | src/persistence/indexedDb.ts:163 | high |
| D-35 | remoteBackend.saveWorkspaceSnapshot | src/persistence/remoteBackend.ts:68 | high |
| D-36 | applyWorkspaceSnapshotToStores (hydration) | src/persistence/hydration.ts:63 | high |
| D-37 | mergeWorkspaceSnapshots | src/persistence/workspaceImportMerge.ts:36 | high |

## Narrative

### Identity extraction (D-1 → D-8)

The user pastes source material in `IdentityPage`. `[D-1]` calls `[D-2] generateIdentityDraft`, which posts to the LLM proxy via `callLlmProxy` with feature='identity.extract'. The raw response goes through `[D-3]` (JSON parse + sentinel extraction), `[D-4]` (field-level normalization — type fixups, whitespace), and `[D-5]` (merge with seed identity if a resume scan provided one). The output `IdentityExtractionDraft` lands in `identityStore` via `[D-6] setDraft` — at this point the draft is reviewable but not canonical. When the user clicks "Apply," `[D-8] applyDraft` promotes the draft to `currentIdentity`.

This is the only path where the user sees a *staging* layer between LLM output and store state. Other generators write directly to their target store.

### Identity → Resume (D-10 → D-12)

`[D-10] handlePushToBuild` calls `[D-11] professionalIdentityToResumeData` (the adapter in `src/identity/resumeAdapter.ts:272`) which projects identity fields into the `ResumeData` shape — including building `vectors`, deriving `RoleComponent`s from `ProfessionalRole`s, and translating skill groups. The output goes to `[D-12] resumeStore.setData`.

This adapter is *the single place* where identity → resume projection happens. Anything downstream operates on `ResumeData`, not on identity directly.

### Resume assembly + render (D-13 → D-19) — see `sequence-resume-render.mmd`

`[D-13] BuildPage` is reactive: a `useMemo` recomputes when `data`/`vector`/`manualOverrides` change, calling `[D-14] assembleResume`. Assembly applies vector filtering and text-variant selection, then `[D-15] applyPageBudget` trims bullets to fit the target page count. The result feeds `[D-16] usePdfPreview` which (after a 400ms debounce) `postMessage`s to `[D-17] typst.worker`. The worker compiles Typst → PDF bytes and posts back. `[D-18]` wraps the bytes in a Blob URL; `[D-19] PdfPreview` renders it in an iframe.

### Search → Pipeline (D-20 → D-23) — see `sequence-pipeline-promotion.mmd`

`ResearchPage` handles a deep-research run that produces `SearchResultEntry`s. When the user promotes one, `[D-20]` calls `[D-21] createPipelineEntryDraft` to shape it into a `PipelineEntry` (without an ID). `[D-22] addEntry` stamps an ID and `durableMeta`, then appends to `[D-23] pipelineStore.entries`. The mutation triggers the persistence subscription chain.

### JD Analysis (D-24)

JD analysis runs from the pipeline workspace. Output is `JDAnalysis` stored in `[D-24] jdAnalysisStore.upsertAnalysis` keyed by analysis ID; `pipelineStore.setJDAnalysisReference` writes the `jdAnalysisId` back onto the pipeline entry. This is the indirection that keeps JDAnalysis in its own store while pipeline holds only the FK.

### Pipeline → Prep (D-25, D-26)

`[D-25] PrepPage.createDeck` reads a pipeline entry and calls `[D-26] prepStore.createDeck`, which sanitizes input and appends a `PrepDeck` (with `pipelineEntryId` FK). The deck inherits company/role/jdAnalysisId from the pipeline entry — that's the carry-over the architecture relies on.

### Cover letter generation (D-28, D-29)

`[D-28] generateCoverLetter` takes identity + a pipeline entry + the JD context, calls the LLM proxy, and returns a `CoverLetterGenerationResult`. `[D-29] upsertLetterForPipelineEntry` writes it to `coverLetterStore` keyed by `pipelineEntryId` (one letter per entry).

### Persistence lifecycle (D-30 → D-37) — see `sequence-snapshot-save.mmd`

This is cross-cutting. **Every** mutation in the seven domain stores hits this path:

1. Zustand `subscribe` callback fires
2. `[D-30] schedulePersist` debounces 150ms (`DEFAULT_SAVE_DEBOUNCE_MS`)
3. After debounce, `[D-31] persistCurrentState` runs
4. `[D-32] createWorkspaceSnapshotFromStores` reads every persisted store into a `FacetWorkspaceSnapshot` envelope
5. `[D-33] coordinator.importWorkspaceSnapshot` routes to backend
6. Either `[D-34]` IndexedDB (local) or `[D-35]` remoteBackend (hosted)

`[D-36] applyWorkspaceSnapshotToStores` is the inverse — runs at app boot during hydration. `[D-37] mergeWorkspaceSnapshots` is the import-merge path used by workspace export/import.

The single-snapshot model means every save writes the entire workspace. This is acceptable because: (a) the debounce collapses bursts; (b) IndexedDB writes are fast; (c) snapshots are typically <2MB. It also makes hydration trivially atomic — there's no partial-state recovery problem.

## Verification log

### Discarded findings

None — every cited line resolved correctly.

### Synthesized cap

- Synthesized share: 0/34 = 0%. All edges have call-site citations.

### Unverified citations

- D-3 (parseIdentityExtractionResponse:1479), D-4 (normalize:1349), D-5 (merge:1491) — file existence verified; specific line offsets within identityExtraction.ts (a long file) were trusted from the subagent's evidence string. Sample-verified D-2 at line 1706.

## Open questions

- Is the 150ms debounce window (`DEFAULT_SAVE_DEBOUNCE_MS`) ever overridden, e.g., for explicit user-save actions that should not wait? Worth tracing `options.saveDebounceMs` callers.
- The `IdentityExtractionDraft` staging pattern (D-5 → D-6) doesn't appear in any other generator path. Is that an inconsistency or a deliberate "high-stakes mutation gets review" guarantee?
- `[D-35] remoteBackend` flow is bidirectional — what reads back? The hydration path probably hits remoteBackend on app boot in hosted mode; not modeled here. See control-flow's hydration sequence.
