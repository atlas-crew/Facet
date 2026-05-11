---
mode: information
date: 2026-05-09
scope: Facet user flow (Identity/Extraction → Search → Pipeline → Prep → Letters/Resume/Recruiter)
diagram: ia.mmd
secondary_diagrams: []
synthesized_share: 0.023
---

# Information Architecture

## Summary

The user flow is layered top-down: a **router shell** routes to **page-level workspaces**, each consuming a **dedicated Zustand store**, with **identity/schema** as the canonical data source feeding both **utils-layer generators** (LLM clients) and the **engine/persistence** stack. Cross-cutting persistence is a three-file coordinator pattern (snapshot → coordinator → runtime) — this is the only synthesized node and the largest architectural commitment outside identity.

The IA's headline observation: **every LLM generator imports from `identity/schema.ts`** and **every store flows through the persistence runtime**. These two convergence points (identity-as-canonical, persistence-as-cross-cutting) are the load-bearing constraints downstream modes operate within.

## Callouts

| ID | Label | Citation | Confidence |
|----|-------|----------|------------|
| I-1 | main.tsx | src/main.tsx:1 | high |
| I-2 | router.tsx | src/router.tsx:1 | high |
| I-3 | AppShell | src/components/AppShell.tsx:231 | high |
| I-5 | identityStore | src/store/identityStore.ts:1 | high |
| I-6 | searchStore | src/store/searchStore.ts:1 | high |
| I-7 | pipelineStore | src/store/pipelineStore.ts:1 | high |
| I-8 | identity/schema.ts | src/identity/schema.ts:1 | high |
| I-9 | identity/skillDedupe.ts | src/identity/skillDedupe.ts:1 | high |
| I-10 | identity/resumeAdapter.ts | src/identity/resumeAdapter.ts:1 | high |
| I-11 | engine/assembler.ts | src/engine/assembler.ts:1 | high |
| I-13 | engine/serializer.ts | src/engine/serializer.ts:1 | high |
| I-14 | engine/pageBudget.ts | src/engine/pageBudget.ts:1 | high |
| I-15 | engine/letterAssembler.ts | src/engine/letterAssembler.ts:1 | high |
| I-16 | persistence/contracts.ts | src/persistence/contracts.ts:1 | high |
| I-17 | persistence/snapshot.ts | src/persistence/snapshot.ts:1 | high |
| I-18 | persistence/coordinator.ts | src/persistence/coordinator.ts:1 | high |
| I-19 | persistence/runtime.ts | src/persistence/runtime.ts:1 | high |
| I-20 | resumeStore | src/store/resumeStore.ts:1 | high |
| I-21 | coverLetterStore | src/store/coverLetterStore.ts:1 | high |
| I-22 | matchStore | src/store/matchStore.ts:1 | high |
| I-23 | jdAnalysisStore | src/store/jdAnalysisStore.ts:1 | high |
| I-24 | linkedinStore | src/store/linkedinStore.ts:1 | high |
| I-25 | recruiterStore | src/store/recruiterStore.ts:1 | high |
| I-26 | debriefStore | src/store/debriefStore.ts:1 | high |
| I-27 | templates/registry.ts | src/templates/registry.ts:1 | high |
| I-28 | utils/identityExtraction.ts | src/utils/identityExtraction.ts:1 | high |
| I-29 | utils/jdAnalysis.ts | src/utils/jdAnalysis.ts:1 | high |
| I-30 | utils/coverLetterGenerator.ts | src/utils/coverLetterGenerator.ts:1 | high |
| I-31 | utils/prepGenerator.ts | src/utils/prepGenerator.ts:1 | high |
| I-32 | utils/thesisGenerator.ts | src/utils/thesisGenerator.ts:1 | high |
| I-33 | utils/searchExecutor.ts | src/utils/searchExecutor.ts:1 | high |
| I-34 | utils/deepSearchClient.ts | src/utils/deepSearchClient.ts:1 | high |
| I-35 | utils/debriefGenerator.ts | src/utils/debriefGenerator.ts:1 | high |
| I-36 | routes/pipeline/PipelinePage.tsx | src/routes/pipeline/PipelinePage.tsx:1 | high |
| I-37 | routes/letters/LettersPage.tsx | src/routes/letters/LettersPage.tsx:1 | high |
| I-38 | routes/prep/PrepPage.tsx | src/routes/prep/PrepPage.tsx:1 | high |
| I-39 | routes/research/ResearchPage.tsx | src/routes/research/ResearchPage.tsx:1 | high |
| I-40 | utils/identityMerge.ts | src/utils/identityMerge.ts:1 | high |
| I-41 | persistence/validation.ts | src/persistence/validation.ts:1 | high |
| I-42 | persistence/normalization.ts | src/persistence/normalization.ts:1 | high |
| I-43 | persistence coordinator pattern | — | synthesized |
| I-44 | prepStore | src/store/prepStore.ts:1 | high |

## Narrative

### Entry chain

`[I-1]` boots the React tree, mounting `[I-2]` which is a TanStack Router `createRouter` instance with 20 route declarations. The router renders `[I-3]` (AppShell) at the root, which is the only screen-level layout in the app — every workspace sits inside it.

### Identity is the gravitational center

`[I-8]` (identity/schema.ts, 1407 lines) defines `ProfessionalIdentityV3` and its constituent shapes (roles, projects, skills, preferences, self-model, search vectors). Seven utils-layer generators import from it directly: `[I-28] identityExtraction`, `[I-29] jdAnalysis`, `[I-30] coverLetterGenerator`, `[I-32] thesisGenerator`, `[I-34] deepSearchClient`, `[I-35] debriefGenerator`, `[I-40] identityMerge`. The engine layer also imports it via `[I-13] serializer.ts`. **No major derivation utility skips identity** — this is the architectural commitment described in `docs/architecture/identity-canonical-data.md`.

### The persistence triad — `[I-43]`

`[I-17] snapshot.ts`, `[I-18] coordinator.ts`, and `[I-19] runtime.ts` jointly implement the three-tier persistence pattern:

- `snapshot.ts` composes the workspace envelope by reading every persisted store
- `coordinator.ts` abstracts the storage backend (IndexedDB, localStorage, remote)
- `runtime.ts` orchestrates the lifecycle: bootstrap, hydrate, subscribe, debounce-persist

`[I-19]` imports both `[I-5] identityStore` and `[I-18] coordinator` — it's the integration point that wires Zustand into the snapshot lifecycle. `[I-41] validation.ts` and `[I-42] normalization.ts` provide the data-shape guards on the boundary.

### Stores fan out by workspace

Each major workspace owns a Zustand store: `[I-5] identityStore`, `[I-6] searchStore`, `[I-7] pipelineStore`, `[I-20] resumeStore`, `[I-21] coverLetterStore`, `[I-22] matchStore`, `[I-23] jdAnalysisStore`, `[I-24] linkedinStore`, `[I-25] recruiterStore`, `[I-26] debriefStore`, `[I-44] prepStore`. `[I-7] pipelineStore` imports from `[I-5] identityStore` directly — pipeline holds references to identity vectors. The other stores are independent at this layer, with cross-store coordination flowing through the persistence runtime rather than direct imports.

`[I-44] prepStore` is the second-largest store at 1341 lines, but its size is sanitization-heavy (PrepDeck and PrepCard each carry ~30 optional fields, each needing a normalizer). Its public surface is a typical 13-method workspace store. The one prep-specific behavior worth flagging: a per-card study-progress tracker (`recordCardReview` at `src/store/prepStore.ts:1280-1305`) maintains `{confidence, attempts, needsWorkCount, lastReviewedAt}` per review key. No other workspace store has this state-machine micro-shape.

### Routes consume stores + utils

The four routes shown in the diagram are the most-trafficked in the user flow:
- `[I-36] PipelinePage` imports `[I-7] pipelineStore` and `[I-29] jdAnalysis` (the analyzer)
- `[I-37] LettersPage` imports `[I-21] coverLetterStore` and `[I-30] coverLetterGenerator`
- `[I-38] PrepPage` imports `[I-31] prepGenerator`, `[I-7] pipelineStore` (deck creation needs the pipeline entry context), and `[I-44] prepStore` (deck CRUD)
- `[I-39] ResearchPage` imports `[I-5] identityStore` and `[I-32] thesisGenerator`

The pattern: **routes hold no logic** beyond UI orchestration; they delegate to a store for state and a util for AI work.

## Synthesized concepts

| ID | Label | Justification |
|----|-------|---------------|
| I-43 | persistence coordinator pattern | The three-tier persistence system has no single owning file — it emerges from the coordination of `src/persistence/snapshot.ts:1` (workspace artifact composition), `src/persistence/coordinator.ts:1` (backend abstraction + status state machine), and `src/persistence/runtime.ts:1` (Zustand subscription orchestration + debounce + lifecycle). The pattern is documented architecturally in `docs/architecture/facet-workspace-topology.md` but no code line owns it. |

## Verification log

### Discarded findings

- I-12 (duplicate of I-11) — both labeled `engine/assembler.ts` with citation `src/engine/assembler.ts:1`. Discarded as redundant; kept I-11.

### Added findings

- I-44 (prepStore) — the IA subagent silently omitted prepStore from its enumeration despite the dispatch prompt explicitly listing it. Confirmed via `Read src/store/prepStore.ts:1` (cites `import { create } from 'zustand'`) and the `PrepState` interface at `src/store/prepStore.ts:106-124`. Added as a peer of the other workspace stores; import edge from `[I-38] PrepPage` reflects the actual consumption.

### Synthesized cap

- Synthesized share: 1/42 = 2.4% (cap: 20%) — well under cap.

### Unverified citations

- I-31 (utils/prepGenerator.ts), I-33 (utils/searchExecutor.ts) — file existence verified via `ls`; line:1 evidence not deeply inspected (subagent's evidence string was multi-line `import { … }`-style, consistent with line:1 being an import statement).

## Open questions

- `src/components/` was scoped in but only `AppShell` made the cut at IA level — most components are leaf-level and belong in UI surfaces. Worth confirming this scoping choice.
