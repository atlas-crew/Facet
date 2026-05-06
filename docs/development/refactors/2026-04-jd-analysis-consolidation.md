# Facet — JD Analysis Consolidation

> Workstream: Pipeline / JD Match / Build / Cross-workspace foundation
> Scope: Audit + canonical JDAnalysis entity + JD Match migration + Build migration
> Estimated effort: 4-6 days post-audit
> Status: Workstreams 1-5 shipped. Canonical JDAnalysis, JD Match migration,
> Build migration, and Interview Prep migration have all landed. No
> remaining duplicates: every consumer reads canonical JDAnalysis.
> Replaces (temporarily): cover letter refactor work — see
> `2026-04-resume-letter-architecture.md` which depends on this work
> Architecture references:
> `docs/architecture/facet-workspace-topology.md` and
> `docs/architecture/identity-canonical-data.md`
>
> **Audit findings (2026-04-29):** Build has its own JD analyzer
> (`jdAnalyzer.ts` — retired by this refactor's Workstream 4) that wasn't
> in original scope. Build migration was added to scope because leaving
> it as a duplicate defeats the consolidation purpose. Interview Prep
> migration was originally deferred but subsequently picked up and
> shipped (commit `44ca083`); see Workstream 5 below for the as-shipped
> details. See `Workstream 4` and answers to audit questions for the
> Build details.

---

## Context

This consolidation implements the canonical workspace topology defined in
`docs/architecture/facet-workspace-topology.md`: Pipeline owns durable job
context, Build owns resume editing, and JDAnalysis bridges job context into
downstream projections. JDAnalysis consumers also follow
`docs/architecture/identity-canonical-data.md`: identity-canonical candidate
claims are referenced from identity, while job-specific positioning remains
artifact-context editorial.

JD analysis was duplicated across workspaces at audit time. The audit
found **four** distinct implementations: JD Match (`jobMatch.ts`, the
most mature), Build (`jdAnalyzer.ts` — since retired), Interview Prep
(embedded in `prepGenerator.ts`'s deck generation), and ad-hoc JD
consumption in cover letter generation. Each implementation uses
different prompts, fields, models (Sonnet vs Haiku), truncation
strategies (1200 vs 800 words), and persistence approaches.

This is bad architecture. It produces inconsistent outputs across
workspaces, costs us multiple LLM calls covering overlapping territory,
and means improvements don't propagate. Each new consumer reinvents
the analysis pass.

This workstream consolidates JD analysis into a canonical pipeline-anchored
entity with consumer-specific projections layered on top. JDAnalysis
becomes a first-class entity attached to pipeline entries. Workspaces
consume from this canonical analysis instead of computing their own;
where consumers need additional shape (Build's resume strategy,
Prep's coaching artifacts), they compute downstream projections from
canonical analysis rather than running independent JD passes.

**Migration order:** JD Match and Build migrate during this workstream.
Cover letter generation will be built on top of canonical JDAnalysis
(separate workstream, blocked on this one). Interview Prep migration
is explicitly deferred — Prep continues using its own generator until
a follow-up workstream picks it up.

---

## Architectural Commitments

### Canonical core + consumer projections

This is the most important architectural decision and emerged from the
audit. The canonical `JDAnalysis` entity covers the **shared analytical
core** — JD-vs-identity matching that all consumers benefit from. It does
NOT cover consumer-specific output formats.

- **Canonical JDAnalysis** stores: requirements extraction, fit scoring,
  skills alignment, evidence mapping, gaps, vector recommendations,
  positioning, advantages, watch-outs. The shared analytical truth.

- **Consumer projections** are computed by their respective consumers
  from the canonical analysis. Build's `bullet_adjustments` and
  `vector_strategy` are a `BuildProjection` derived from canonical
  analysis. Prep's `rules`, `donts`, `questionsToAsk`, `interviewers`
  are a `PrepProjection`. Cover letter input is mostly already in the
  canonical core; no separate projection needed.

- Projections are computed lazily for v1 — when a consumer needs its
  projection, it derives it from canonical analysis in-memory. No
  separate persistence for projections initially.

This keeps the canonical entity coherent and consumer-agnostic. The
schema covers analytical fields (shared meaning across consumers) but
excludes consumer-specific output formats.

### JDAnalysis as canonical entity

- Lives in its own store, pipeline-anchored.
- Single analysis per pipeline entry's JD text (no versioned history for v1).
- Stored persistently — not recomputed on every consumer access.
- Drift detection via JD content hash; analysis goes stale when JD changes.
- Drift detection via identity version; analysis stale when identity updates.

### Pipeline entry as analysis container

- Pipeline entries reference their JDAnalysis by ID.
- Analysis creation is **explicit-only** for v1. User clicks "Analyze JD"
  on a pipeline entry that has a JD. No auto-trigger on consumer access.
- When a consumer needs analysis and one doesn't exist, surface a prompt
  with a one-click action to run analysis. User decides; system doesn't
  fire LLM calls unilaterally.
- Pipeline entries can exist without analysis (manual-add path); analysis
  can be added later by the user.

### JD Match workspace migrates to read/write canonical analysis

- JD Match's existing analysis logic gets extracted into a shared service
  that produces JDAnalysis entities.
- The workspace UI reads from canonical JDAnalysis, doesn't compute its own.
- Promoting a JD Match result to a pipeline entry attaches the existing
  JDAnalysis to that entry.

### Build workspace migrates to consume canonical analysis

- Build's `jdAnalyzer.ts` gets retired. Build's resume strategy (currently
  produced by its own JD pass) becomes a `BuildProjection` derived from
  canonical JDAnalysis.
- Build's direct JD-paste/job-generation entrypoint is retired. During
  Bundle 1, the legacy Pipeline-to-Build handoff remains available so users
  still have a path to generate and edit a job-specific resume from Pipeline.
  Bundle 2 replaces that intermediate handoff with the Pipeline entry
  variant selector (`vector`, `ephemeral_vector`, `dynamic`).
- Build's existing fields (`bullet_adjustments`, `suggested_target_line`,
  `vector_strategy`, `suggested_variables`, etc.) are computed from
  canonical analysis at consumption time.
- The audit confirmed Build does genuine duplicate JD analysis work that
  overlaps with JD Match. Migrating it now eliminates the duplicate;
  leaving it produces a known active duplicate.

### Interview Prep migration is explicitly out of scope

- Interview Prep's current analysis stays as-is during this workstream.
- Migrating Interview Prep to canonical analysis is a follow-up workstream.
- Acknowledged technical debt; documented as a known TODO.

---

## Workstream 1: Audit (COMPLETE — 2026-04-29)

Audit completed. Findings:

- **JD Match** is the most mature implementation (`jobMatch.ts`); should be
  the baseline quality bar. Multi-pass Sonnet, 1200-word truncation,
  comprehensive output via `VectorAwareMatchResult` and `MatchReport` types.
- **Build** has a separate JD analyzer (`jdAnalyzer.ts`) — single Haiku pass,
  800-word truncation, produces resume-strategy fields. **Active duplicate.**
- **Interview Prep** embeds JD analysis inside `prepGenerator.ts`'s deck
  generation. Cannot be cleanly extracted without significant Prep refactor.
  Out of scope for this workstream.
- **Cover letters** consume JD text but don't produce reusable analysis;
  generator output is letter-only.
- **Pipeline investigation** (`pipelineInvestigation.ts`) is JD-related
  research (search-backed), not identity-vs-JD matching. Distinct concern.
- **JD Match persistence** is local-only Zustand (`facet-match-workspace`),
  not durable workspace artifacts. Migration of existing Match data is
  minimal because most analyses are session-scoped.

Full audit document with file paths and line numbers preserved separately.

The five product questions raised by the audit are answered in the
`Decisions` section below.

### Union of fields (for canonical schema design)

The audit produced the union of fields across current implementations.
The canonical `JDAnalysis` schema should cover the analytical core
(see Workstream 2 schema). Consumer-specific fields (Prep coaching
artifacts, Build resume strategy outputs, letter prose) become
projections, not canonical fields.

---

## Workstream 2: Canonical JDAnalysis Entity

### Goal

Build the canonical JDAnalysis entity with a quality bar that meets
JD Match's current output. Build's needs are met via projection.
Cover letter's needs are met by canonical fields directly. Prep's
analysis remains its own (deferred migration).

### Tasks

1. **Define JDAnalysis schema** as canonical analytical core only:

   ```
   JDAnalysis {
     // Anchoring & metadata
     id
     pipeline_entry_id              // pipeline-anchored, required
     jd_text_hash                   // for drift detection
     identity_version               // identity state at analysis time
     model_version                  // which prompt/LLM produced this
     generated_at
     updated_at
     warnings                       // any analysis-time warnings

     // JD requirements (extracted from JD)
     requirements                   // structured list
       - id, label, priority, evidence, tags, keywords

     // Fit & scoring (overall match assessment)
     overall_fit                    // 'strong' | 'moderate' | 'weak' | etc.
     fit_score                      // numeric
     confidence                     // numeric
     recommendation                 // string
     one_line_summary
     rationale

     // Vector & evidence mapping (which parts of identity match)
     matched_vectors                // structured list with scores
     primary_vector_id
     skill_matches                  // per-requirement, with depth/positioning/quality/guidance
     evidence_mapping
       - top_bullets
       - top_skills
       - top_projects
       - top_profiles
       - top_philosophy

     // Strengths & risks
     strengths_to_lead              // what to emphasize
     advantages                     // structured
     advantage_hypotheses
     gaps                           // identified gaps
     gap_focus
     watch_outs                     // risks to manage

     // Preferences awareness
     triggered_prioritize           // matched user prioritize criteria
     triggered_avoid                // matched user avoid criteria
     relevant_awareness             // matched awareness questions

     // Positioning guidance
     positioning_recommendations

     // Coverage metrics
     requirement_coverage_score
     matched_requirement_ids
     matched_keywords
   }
   ```

   This is the **canonical core** — the shared analytical truth. All
   consumers read from this. Fields are sourced from JD Match's existing
   `VectorAwareMatchResult` and `MatchReport` types since JD Match is
   the quality baseline.

   **Not in canonical schema:** Build's `bullet_adjustments`,
   `suggested_target_line`, `suggested_variables`, `vector_strategy`
   (these become BuildProjection). Prep's `rules`, `donts`,
   `questionsToAsk`, `numbersToKnow`, `categoryGuidance`, `interviewers`,
   `lineThatLands`, etc. (these become PrepProjection when Prep migrates).
   Cover letter prose (this is the letter generator's output).

2. **Build the canonical analysis service.**
   - Single function/service: takes JD text + identity model state,
     produces JDAnalysis output.
   - Quality bar: meets JD Match's current output (multi-pass Sonnet,
     comprehensive structured output).
   - Replaces JD Match's inline analysis logic and Build's `jdAnalyzer.ts`.

3. **Persistence and store.**
   - JDAnalysis store with CRUD operations.
   - Pipeline entry references analysis by ID.
   - Durable persistence as workspace artifact (not local-only like
     current JD Match).
   - One analysis per pipeline entry; re-running replaces existing.
     No versioned history for v1.

4. **Drift detection.**
   - JD text hash on pipeline entry compared to hash on attached JDAnalysis.
   - Identity version on JDAnalysis compared to current identity version.
   - When either diverges, analysis is marked stale.
   - Stale analysis can still be read but UI surfaces "analysis is out of
     date" prompts. **Do not auto-rerun** — user must trigger explicitly.

5. **Trigger logic (locked decisions).**
   - Analysis creation is **explicit-only**. Pipeline entry view has
     "Analyze JD" action when JD exists.
   - When consumers need analysis and one doesn't exist: surface prompt
     ("Run analysis to enable [feature]") with one-click trigger. Never
     fire LLM calls automatically.
   - When JD changes: hash changes, analysis marked stale, user prompted
     to re-analyze. No auto-rerun.
   - When identity changes: version changes, analysis marked stale,
     same prompt-to-re-analyze pattern.

### Open questions for the agent to surface during implementation

- BuildProjection computation strategy: pure function from JDAnalysis
  output, or does it need additional Build-specific input (current
  workspace state, vector configuration)?
- Stale-analysis read behavior: UI displays cached output with stale
  badge, or refuses to display until re-analyzed?
- Identity version granularity: single version number for whole identity,
  or per-section versions (skills version, bullets version, etc.)?

---

## Workstream 3: JD Match Migration

### Goal

JD Match workspace becomes a consumer of canonical JDAnalysis instead of
computing its own analysis.

### Tasks

1. **Refactor JD Match workspace to use canonical analysis service.**
   - Remove inline analysis logic.
   - Call the canonical analysis service when user triggers analysis.
   - Display canonical JDAnalysis output in the workspace UI.

2. **Promote-to-pipeline flow.**
   - When user promotes a JD Match result to a pipeline entry, the existing
     JDAnalysis attaches to the new pipeline entry.
   - No re-analysis needed — the analysis that existed in JD Match becomes
     the pipeline entry's analysis.

3. **Display behavior.**
   - JD Match workspace UI may need updates to render the canonical
     analysis output (which may have a different shape than the
     workspace's current internal output).
   - Preserve the user-facing experience as much as possible during migration.

4. **Migration of existing JD Match data.**
   - Any persisted JD Match analyses get migrated to canonical JDAnalysis
     entities.
   - If JD Match analyses weren't persisted (recomputed each time), nothing
     to migrate.

---

## Workstream 4: Build Migration

### Goal

Build workspace stops running its own JD analysis. Build's resume strategy
output becomes a projection computed from canonical JDAnalysis.

### Tasks

1. **Retire `jdAnalyzer.ts`.**
   - Remove the standalone Build JD analysis logic.
   - Build no longer makes its own LLM call for JD analysis.

2. **Build BuildProjection from canonical JDAnalysis.**
   - Pure function (or minimal-state function) that takes canonical
     JDAnalysis + current workspace state + vector configuration, produces:
     - `primary_vector` (mapped from canonical `primary_vector_id`)
     - `suggested_vectors` (mapped from canonical `matched_vectors`)
     - `bullet_adjustments` (computed from canonical evidence_mapping +
       skill_matches + workspace bullets)
     - `suggested_target_line` (computed from canonical positioning +
       primary_vector)
     - `skill_gaps` (mapped from canonical gaps + skill_matches)
     - `matched_keywords` (already in canonical)
     - `suggested_variables` (computed from canonical evidence_mapping)
     - `positioning_note` (mapped from canonical positioning_recommendations)
     - `vector_strategy` (computed from canonical matched_vectors +
       evidence)

3. **Refactor Build workspace UI.**
   - Build reads canonical JDAnalysis from the pipeline entry's reference
     when one exists.
   - When no JDAnalysis exists, surface "Run JD analysis to get tailored
     resume strategy" prompt with one-click trigger.
   - Existing Build UI (vector planning, skill gaps, positioning displays)
     continues to render — sourced from BuildProjection now.

4. **Migration of existing Build state.**
   - Build's analyzer output was component state only — nothing durable
     to migrate.
   - Users currently in mid-flow lose their in-component direct-paste
     analysis; they re-trigger analysis from Pipeline. Pipeline-launched
     generation remains available during Bundle 1 to avoid a UX dead zone.

### Bundle 1 intermediate state

Bundle 1 intentionally wraps the legacy Pipeline-to-Build handoff instead of
removing it outright. The handoff is the temporary compatibility bridge while
Build stops owning direct JD paste and direct application-context generation.
Pipeline is already the launch point, but Bundle 2 introduces the permanent
variant selector on Pipeline entries and replaces the handoff-centered path.

### Why this is in scope

The audit found Build's `jdAnalyzer.ts` is doing genuine duplicate JD
analysis work — different prompt, different model (Haiku vs Sonnet),
different fields, but overlapping intent with JD Match's analysis.
Leaving it alone produces a known active duplicate, which defeats the
consolidation purpose. Retiring it now is cheaper than retiring it later.

---

## Workstream 5 (Out of Scope, Documented for Later)

Interview Prep migration to canonical JDAnalysis. Specifically:

- Interview Prep currently does its own JD analysis.
- Migrating it to canonical analysis means the prep generator reads from
  pipeline entry's JDAnalysis instead of computing its own.
- This is acknowledged technical debt during this workstream.
- Will be picked up after JD Match migration lands and the canonical
  analysis pattern is stable.

Cover letter refactor workstream (separate spec) also depends on canonical
JDAnalysis. It can proceed once Workstream 2 lands.

---

## Out of Scope for This Workstream

- Interview Prep migration (Workstream 4 above)
- Cover letter refactor (separate spec, blocked on this work)
- Search workspace integration with canonical analysis (future)
- Analysis quality improvements beyond meeting current consumer needs
- Prompt engineering for new analysis fields not currently used
- Multi-model analysis (running analysis through different LLMs and
  comparing) — single canonical model for now

---

## Risks and Decisions

### Decided

- **Canonical core + consumer projections.** JDAnalysis stores shared
  analytical truth; consumer-specific output (Build's resume strategy,
  Prep's coaching, letter prose) computed downstream as projections.
- **JDAnalysis is pipeline-anchored.** Lives on pipeline entries.
- **One canonical analysis per pipeline entry.** No versioned history
  for v1. Re-runs replace existing.
- **Durable persistence as workspace artifact.** Not local-only like
  current JD Match Zustand state.
- **Build migrates now alongside JD Match.** Active duplicate; cheaper
  to consolidate now than later.
- **Interview Prep migration deferred.** Follow-up workstream.
- **Quality bar is JD Match's current output.** Multi-pass Sonnet,
  comprehensive structured output.
- **Drift detection via content hash + identity version.** Both checked.
  When either diverges, analysis marked stale.
- **Analysis creation is explicit-only.** No auto-trigger on consumer
  access. User clicks "Analyze JD" or one-click prompt from consumer
  surface.
- **JD changes prompt user; do not auto re-analyze.** Stale flag set,
  user decides whether to re-run.
- **Identity changes prompt user; do not auto re-analyze.** Same pattern.
- **Migration of existing JD Match data is minimal.** Local-only state
  is mostly transient. If a current Match analysis exists at migration
  time, discard it; user re-runs analysis after migration.
- **Cover letter refactor unblocks after this lands.** Letter generator
  consumes canonical JDAnalysis.

### Open (agent surfaces during implementation)

- BuildProjection computation: pure function or stateful?
- Stale-analysis read behavior: cached output with stale badge, or refuse
  to display?
- Identity version granularity: single version or per-section versions?
- Snapshot semantics for canonical analysis at apply-time (relates to
  cover letter refactor's snapshot work)

---

## Success Criteria

1. **JD Match workspace produces analysis via canonical service**, not
   inline logic.
2. **Build workspace consumes canonical analysis via BuildProjection**,
   `jdAnalyzer.ts` retired.
3. **JDAnalysis entities are persisted** durably as workspace artifacts,
   queryable by pipeline_entry_id.
4. **Promote-to-pipeline preserves analysis** without recomputation.
5. **Drift detection works** — editing JD text or identity version
   marks attached analysis as stale.
6. **No regression in JD Match output quality** — what users saw before,
   they see after migration.
7. **No regression in Build resume-strategy quality** — projection
   produces output equivalent to (or better than) current jdAnalyzer.
8. **Cover letter refactor is unblocked** — canonical JDAnalysis exists
   and has the fields the letter generator needs.
9. **Interview Prep continues to function** with its own analysis,
   documented as TODO for later migration.

---

## Implementation Order

1. ~~Audit (Workstream 1)~~ — **COMPLETE 2026-04-29**.
2. ~~Canonical JDAnalysis entity + service (Workstream 2)~~ — **SHIPPED**.
   Pipeline-anchored JDAnalysis entities, persistence, drift inputs, and
   shared generation helpers are now the canonical foundation.
3. ~~JD Match migration (Workstream 3)~~ — **SHIPPED**. JD Match writes
   canonical JDAnalysis and promote-to-pipeline preserves that analysis
   instead of recomputing.
4. ~~Build migration (Workstream 4)~~ — **SHIPPED**. Build consumes
   canonical JDAnalysis through BuildProjection, `jdAnalyzer.ts` is retired,
   and job-specific resume generation requires a Pipeline entry with
   canonical analysis.
5. ~~Interview Prep migration (Workstream 5)~~ — **SHIPPED** (commit
   `44ca083`). `PrepGenerationRequest` now takes a canonical `JDAnalysis`;
   Prep formats it for the deck-generation prompt via
   `formatJdAnalysisForPrompt` and pins drift markers (`jdAnalysisId`,
   `jdAnalysisGeneratedAt`, `jdAnalysisModelVersion`, `jdTextHash`) on
   each generated deck. No embedded analyzer remains in the prep
   generator.
6. **Cover letter workstream is unblocked.** Letter generation consumes
   canonical JDAnalysis through `CoverLetterJDAnalysisContext` rather
   than running a separate JD analysis pass.

---

## Relationship to Cover Letter Refactor

The cover letter refactor doc (`2026-04-resume-letter-architecture.md`)
was originally going to build its own JD analysis as part of letter
generation. With this consolidation, cover letter generation reads from
canonical JDAnalysis instead.

Cover letter follow-up requirements:
- Letter generator consumes JDAnalysis from pipeline entry
- Letter generator surfaces "no JD analysis yet" prompts when one doesn't
  exist (with action to trigger analysis)
- No JD analysis logic in the letter generator itself

The cover letter refactor is unblocked and owned by the separate
resume-letter architecture workstream. Interview Prep, originally the
last documented duplicate, has since migrated (Workstream 5 above) and
is no longer outstanding.
