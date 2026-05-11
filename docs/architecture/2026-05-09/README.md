---
date: 2026-05-09
scope: Facet user flow (Identity/Extraction → Search → Pipeline → Prep → Letters/Resume/Recruiter)
modes: [information, data-model, data-flow, integrations, ui-surfaces, control-flow, failure-modes]
target_repo: /Users/nick/Developer/Facet
---

# Architectural Analysis — 2026-05-09

## Scope

Snapshot of Facet's canonical user flow from **identity extraction** through **search/research → pipeline → prep → letters/resume/recruiter** derived artifacts, plus the cross-cutting **persistence** and **assembly engine** layers those workspaces depend on.

**Included:**
- All in-scope route components under `src/routes/` (10 routes: identity*, research, match, pipeline, prep*, letters, build, linkedin, recruiter, debrief)
- Identity domain (`src/identity/` — schema, resumeAdapter, skillDedupe)
- Engine layer (`src/engine/` — assembler, pageBudget, serializer, letterAssembler, typst.worker)
- Persistence (`src/persistence/` — coordinator, snapshot, runtime, validation, normalization, indexedDb, remoteBackend, fileSystemAccess, hydration, etc.)
- Domain stores (`src/store/` — identity, pipeline, prep, search, resume, coverLetter, jdAnalysis, linkedin, recruiter, match, debrief)
- AI generators (`src/utils/*Generator.ts`, `src/utils/llmProxy.ts`, `src/utils/aiAccess.ts`)

**Excluded:**
- `/account`, `/admin`, `/help`, `/legal`, `/home` routes (not in user-flow scope)
- Test fixtures and `src/test/`
- Theme system (`src/themes/`)
- Dev-only tooling and `src/dev/`

## Modes included

- **[Information architecture](information/report.md)** — Identity is the gravitational center: every LLM generator imports `identity/schema.ts`. Persistence is a synthesized three-file coordinator pattern.
- **[Data model](data-model/report.md)** — Two centers of gravity: ProfessionalIdentityV3 (canonical) and PipelineEntry (durable application record). Derived artifacts (Resume, CoverLetter, LinkedIn, Recruiter, Debrief) all reference identity by FK + identityVersion stamp.
- **[Data flow](data-flow/report.md)** — Six critical paths converge on a single persistence boundary. The 150ms `schedulePersist` debounce is the design's response to write amplification.
- **[Integrations](integrations/report.md)** — No direct anthropic-sdk usage; every LLM call goes through `callLlmProxy`. Typst WASM via Web Worker is the only non-LLM external compute.
- **[UI surfaces](ui-surfaces/report.md)** — 20 routes; 14 in scope. Three eager-loaded routes (Build, Pipeline, Recruiter) are the daily-driver triad.
- **[Control flow](control-flow/report.md)** — Persistence coordinator is an explicit 6-state machine. Render uses generation-counter to discard stale worker responses. Deep-research uses concurrent SSE + poll-loop with stepped backoff.
- **[Failure modes](failure-modes/report.md)** — No automatic retry at proxy boundary; retry is caller-side and rare. Persistence collapses all errors to offline/error binary. Typst worker keeps old preview on render error rather than blanking.

## Cross-mode index

| Callout | Origin mode | Also referenced from | Label |
|---------|-------------|----------------------|-------|
| I-8 | information | data-model (as M-1 root, etc.), data-flow (D-2 imports) | identity/schema.ts |
| I-17, I-18, I-19 | information | control-flow (C-2…C-13), data-flow (D-30…D-34) | persistence triad files |
| I-43 | information | control-flow (the coordinator state machine is its operational form) | persistence coordinator pattern (synthesized) |
| M-1 | data-model | data-flow (D-9 currentIdentity), IA (I-8 owns this type) | ProfessionalIdentityV3 |
| M-20 | data-model | data-flow (D-22 addEntry produces, D-23 entries collection) | PipelineEntry |
| M-22 | data-model | data-flow (D-24 jdAnalysisStore.upsertAnalysis), failure-modes | JDAnalysis |
| M-29 | data-model | data-flow (D-26 prepStore.createDeck) | PrepDeck |
| M-33 | data-model | data-flow (D-12 resumeStore.setData), control-flow | ResumeData |
| M-44 | data-model | failure-modes (F-37 backfill stamps it), data-flow | DurableMetadata |
| D-30 | data-flow | control-flow (C-13), failure-modes (debounced retry trigger) | schedulePersist (150ms debounce) |
| D-32 | data-flow | control-flow (C-10 inverse via applyWorkspaceSnapshotToStores) | createWorkspaceSnapshotFromStores |
| C-13 | control-flow | data-flow (D-30 same node) | schedulePersist debounce |
| C-26 | control-flow | data-flow (D-17 same worker) | typst.worker spawn |
| C-31 | control-flow | failure-modes (stale-response guard prevents corrupt preview) | renderGenerationRef stale-response guard |
| F-1 | failure-modes | control-flow (C-20 categorizer produces this), integrations (X-3 boundary) | FacetAiProxyError |
| F-2 | failure-modes | control-flow (offline phase resolves via this), integrations (X-20 produces this) | FacetApiError |
| F-30 | failure-modes | control-flow (C-30 same site) | preserve old preview on render error |
| X-2 | integrations | data-flow (LLM calls go here), control-flow (C-18 boundary), failure-modes | Anthropic API (via proxy) |
| X-21 | integrations | data-flow (D-35 hosted persistence), control-flow (C-35 hosted bootstrap) | Facet hosted persistence backend (Supabase) |
| X-26, X-27 | integrations | data-flow (D-17 typst.worker), control-flow (C-26 worker spawn) | typst.worker + Typst WASM |
| U-2 | ui-surfaces | control-flow (C-34 bootstrap branch on deployment mode) | AppShell |
| OBS-1 | ui-surfaces | control-flow (C-40 lazy route boundaries) | Eager-loaded triad signal |

## Headline findings

1. **Identity is the gravitational center of the data model and the IA simultaneously.** `[M-1] ProfessionalIdentityV3` (1407-line schema) is referenced by **seven LLM generators** at the IA level and is the source of every derived artifact at the data-model level. Memory's `identity-canonical-data` principle is structurally enforced: artifacts mirror identity rather than store independent fields.

2. **Persistence is a single-snapshot, debounced, cross-cutting concern with explicit state-machine semantics.** The 150ms `schedulePersist` debounce (`[D-30]`/`[C-13]`), the 6-state coordinator (`[C-1]`…`[C-9]`), the legacy-storage migration path (`[C-11]`), and the cross-tab sync (`[C-15]`/`[C-16]`) make persistence one of the architecturally heaviest layers — and the only one with a coordinator-pattern synthesized abstraction (`[I-43]`).

3. **The proxy boundary is a deliberate, non-bypassable architectural commitment.** No direct `@anthropic-ai/sdk` usage; every LLM call routes through `[X-1] resolveAiAccess` → `[X-10] callLlmProxy` → `[X-2]` Anthropic. This concentrates entitlement gating, error categorization (`[F-3]` readAiProxyError), and timeout policy in one boundary — and gives hosted/local mode a clean swap point.

4. **Retry is rare and explicit; failure containment dominates.** Only `[F-13]` jobMatch (2 attempts) and `[F-41]` deep-research polling have retry. Typst worker has zero retry but compensates with `[F-30]` "keep old preview." Persistence has no retry but binarizes all errors to offline/error via `[F-23] resolvePersistenceFailurePhase`. The pattern: surface failures to UI catches rather than hiding them in retry policies.

5. **The eager-loaded triad (Build, Pipeline, Recruiter) is an architectural assertion about the daily-driver workflow.** 17 of 20 routes are `React.lazy()`; only those three are eager imports in `[U-1] router.tsx:4-6`. This embeds the topology doc's "pipeline owns durable job context" principle in the bundle-splitting decision: the durable-context surfaces load instantly; the AI-dependent surfaces pay a code-split cost on first navigation.

6. **The Typst rendering boundary has the codebase's most carefully-engineered concurrent control flow.** `[C-31]` renderGenerationRef discards stale worker responses; `[C-27]` 400ms debounce coalesces prop changes; `[C-32]` terminate-on-unmount prevents leaks; `[C-29]` revokes previous blob URLs. This is unusual care for a "preview" surface — the engineering effort signals how often render is on the user's critical path.

7. **The Search → Pipeline → Prep flow is structurally enforced by FK references, not duplicated state.** `[M-29] PrepDeck` carries `pipelineEntryId`, `pipelineRoundId`, and `jdAnalysisId` — three FKs back into the canonical pipeline cluster. PipelineEntry similarly references `JDAnalysis` and `CoverLetter` by ID, not by embedded copy. This is what lets the workspace topology stay coherent even with 11 stores: cross-store relationships flow through the data model, not the runtime.

## Verification summary

| Mode | Findings | Verified | Repaired | Discarded | Synthesized | Synthesized share |
|------|----------|----------|----------|-----------|-------------|-------------------|
| Information architecture | 44 | 43 | 1 (added I-44 prepStore) | 1 (duplicate I-12) | 1 (I-43) | 2.3% |
| Data model | 55 | 55 | 0 | 0 | 0 | 0% |
| Data flow | 38 | 38 | 0 | 0 | 0 | 0% |
| Integrations | 45 | 40 | 0 | 5 (out-of-scope) | 0 (re-classified to external) | 0% |
| UI surfaces | 66 | 52 | 14 (page-export lines) | 0 (page nodes themselves valid) | 1 (OBS-1) | 1.9% |
| Control flow | 40 | 40 | 0 | 0 | 0 | 0% |
| Failure modes | 50 | 50 | 0 | 0 | 0 | 0% |
| **Total** | **338** | **318** | **15** | **6** | **2** | — |

Citation verification used the codanna MCP index for symbol resolution where applicable, plus targeted `grep` for absence-claim refutation and `Read` for line-content matching. The discard-and-repair log is preserved in each mode's `report.md` `Verification log` section.

## Diagrams

- [Information architecture](information/ia.svg) (rendered from `information/ia.mmd`)
- [Data model — ERD](data-model/erd.svg)
- [Data flow — pipeline](data-flow/flow.svg) | [Sequence — resume render](data-flow/sequence-resume-render.svg) | [Sequence — pipeline promotion](data-flow/sequence-pipeline-promotion.svg) | [Sequence — snapshot save](data-flow/sequence-snapshot-save.svg)
- [Integrations — boundaries](integrations/boundaries.svg)
- [UI surfaces — routes](ui-surfaces/routes.svg) | [UI surfaces — components](ui-surfaces/components.svg)
- [Control flow — state machine](control-flow/state.svg) | [Sequence — render lifecycle](control-flow/sequence-render-lifecycle.svg) | [Sequence — hydration](control-flow/sequence-hydration.svg) | [Sequence — research job](control-flow/sequence-research-job.svg)
- [Failure modes](failure-modes/failures.svg)

## Open questions

Aggregated from per-mode reports, de-duplicated:

- **Schema migration mechanics:** `[F-37]` silent backfill handles schema *additions*; what about renames or field-type changes? Inspect `validation.ts` migration logic.
- **Typst preview cache lifecycle:** `[F-30]` "keep old preview on error" depends on the previous blob URL existing; first-render-after-navigation has no fallback. Bug or intentional?
- **LLM retry asymmetry:** Why does `[F-13]` jobMatch retry but no other generator? Idempotency-driven decision, or accident of evolution?
- **Deep-research circuit breaker:** `[F-41]` poll-on-error keeps polling indefinitely with `[F-42]` capped 30s intervals. Is there a max-attempts guard, or does the user have to abort?
- **Deep-link bridge band-focus lock:** `/identity` was redesigned around a single canvas + bands + sticky inspector (the Model/Strategy tab shell is gone — `src/routes/identity/IdentityMapPage.tsx:24-32`). The bridge has three params: `?sel` (12+ variant inspector-pin), `?focus` (band-scroll, currently bounded to `['preferences']` by explicit lock at `src/utils/mapSelectionUrl.ts:184`), and `?return` (back-link breadcrumb). When does the bounded-set lock become friction as other workspaces gain landing-target needs?
- **Worker pool need:** `[X-29]` Web Worker is single-instance per `usePdfPreview` mount. Does side-by-side compare or multi-preview UI need a pool?
- **Pipeline panel composition:** Pipeline workspace decomposes into 6 panels; other workspaces have ~1. Is pipeline genuinely richer or is it accumulating complexity?
- **Eager-load triad rationale:** Why Build/Pipeline/Recruiter specifically? Recruiter is less obviously a daily driver than the other two.
- **MatchReport entity gap:** `MatchReport` (`src/types/match.ts:175`) referenced by JDAnalysis fields but not modeled in the ERD.

## Methodology note

This report was generated by the `architectural-analysis` skill on 2026-05-09. Seven sub-agents (haiku Explore × 4 enumeration modes, sonnet general-purpose × 3 reasoning modes) ran in parallel against an explicit user-flow scope. The orchestrator ran the verification protocol over all 337 candidate findings — using the codanna MCP index for symbol resolution and `Read`/`grep` for line-content matching — discarding 6 (1.8%), repairing 14 line citations (4.2%), and re-classifying 17 integration external nodes from `synthesized` to the `external` classDef before any node landed in a diagram. Synthesized share is under the 20% cap in every mode (max 2.4% in Information Architecture). Absence claims were independently grep-refuted before survival; one absence claim survived (`[F-14]` no Typst worker retry).

Per-mode `report.md` `Verification log` sections preserve the discard-and-repair record. The `Open questions` lists across modes are seeds for follow-up, not findings.
