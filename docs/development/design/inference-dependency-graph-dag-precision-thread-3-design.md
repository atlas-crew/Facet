# Thread 3 — Inference Dependency Graph: Linear Chain → DAG Precision

**Status:** Implemented (2026-06-11). Thread 3 of the roadmap in
[`identity-derivation-graph-reframe-and-roadmap.md`](./identity-derivation-graph-reframe-and-roadmap.md).
See the **Implementation notes** at the bottom for the as-built DAG and the two edge decisions
that diverged from (or sharpened) this design's proposed table.

**One line:** Replace the conservative *linear* inference dependency chain with an **authored
semantic DAG** of material consumption edges, so intra-identity staleness is precise instead of
paranoid — accepting that, because the generators are full-context, this is a deliberate
under-approximation with an explicit inclusion rule.

---

## The decisive finding: generators are full-context

`src/utils/identityParametersGeneration.ts:75` — every identity generator (thesis, profiles,
self-knowledge, positioning, search vectors, …) builds its prompt from
`buildGenerationPrompt(identity)`, which serializes **the entire identity** — all twelve
regions (`identity`, `self_model`, `preferences`, `skills`, `profiles`, `expertise`, `roles`,
`projects`, `education`, `generator_rules`, `search_vectors`, `awareness`).

**Consequence:** the true *mechanical* dependency is "every section depends on every region."
You cannot grep the real edges out of the code — the code says everything-on-everything. The
existing linear chain (`identityInferenceDependencies.ts`) is not laziness; it is a deliberate
**over-approximation** chosen because the mechanical truth (all-on-all) produces a useless
signal (every edit marks every section stale).

So Thread 3 is **authoring a semantic model**, not extracting one. It chooses a point on this
spectrum:

| Model | Behavior | Problem |
|---|---|---|
| Full-context truth | every edit → every section stale | useless: total noise |
| **Linear chain (today)** | ordered transitive over-approximation | false positives (edit thesis → flags positioning even if positioning didn't use it) |
| **Authored semantic DAG (this thread)** | material-driver edges only | risk of false *negatives* (asserts education doesn't move positioning, though it was in context) |

The DAG trades the linear chain's false positives for a controlled risk of false negatives. That
is the right trade **once corrections drive the cascade** (Thread 1): a user who corrects a
skill and sees their thesis flag stale understands it; a user who corrects their email and sees
*everything* flag stale learns to ignore the signal. Matching user intuition about "what my edit
could have changed" is worth a small, documented under-approximation.

---

## Inclusion rule (what counts as an edge)

A region *R* is a **material input** of section *S* iff *R* is a **primary driver** of *S*'s
output — i.e. *S*'s generator prompt instructs the model to ground that part of the output in
*R*, not merely that *R* is present in the serialized context. Presence in context is not an
edge; being a named driver is.

**This rule means every proposed edge below must be validated against the section's generator
prompt instructions at implementation time** (the prompt bodies in
`identityParametersGeneration.ts` and the bullet/skill generators), not assumed from this table.
The table is the authored proposal; the prompts are the ground truth for whether a dependency is
"material."

---

## The proposed DAG

Sections in authoring order (`IDENTITY_INFERENCE_ORDER`): `bullets → skills → thesis → profiles
→ chapters → selfKnowledge → positioning → search`. Edges are **material inputs**, not the
linear-successor approximation.

| Section | Material inputs (upstream) | Notes |
|---|---|---|
| **bullets** | `roles[].bullets[].source_text` (raw evidence) | Root evidence. No upstream *section*; deepened from source text. |
| **skills** | `roles`/`bullets`, `projects` | Depth/calibration grounded in demonstrated use. |
| **thesis** | `roles`/`bullets`, `skills`, `self_model` (arc, moat), `expertise` | |
| **profiles** | `roles`/`bullets`, `skills`, `thesis`, `expertise` | |
| **chapters** (`self_model.arc`) | `roles` (company/title/date sequence) | **Authored, not derived** — `SelfModelBand.tsx:57` explicitly forbids auto-deriving chapters from `roles[]` (degenerate). Roles are *input context*; the arc is interpretation. |
| **selfKnowledge** (philosophy, interview_style) | `roles`/`bullets`, `self_model.arc`, `thesis` | |
| **positioning** (`competitive_moat`, `unfair_advantages`) | `thesis`, `skills`, `self_model`, `expertise`, `roles` | |
| **search** (`search_vectors`) | `thesis`, `positioning`, `skills`, `preferences` (matching/interview_process/constraints), `self_model` | Terminal. |

Downstream (consumers) is the transpose of the above — e.g. correcting **skills** marks
`thesis`, `profiles`, `positioning`, `search` stale; correcting a **bullet** marks effectively
the whole narrative layer; correcting **contact basics** marks nothing (no section names it a
driver). This is the precision Thread 1's conservative version can't express: today, editing the
thesis flags `profiles…search` linearly; here it flags only the sections that name thesis a
driver.

---

## Interface — no signature change

Thread 1 depends on `getDownstreamIdentityInferenceSections(section)`. Thread 3 changes that
function's **graph data** (linear chain → DAG adjacency) and therefore its **output** (a
precise set), but **not its signature**. Thread 1 ships against the function; Thread 3 swaps the
data underneath. The producer/owner map in Thread 1 (region → owning section) is unaffected; only
the downstream expansion sharpens.

## Field-path vocabulary & the fingerprint convergence

- Express edges in the same field-path language as `artifactMeta.identityFields` so the
  intra-identity graph (Graph 2) and the identity→artifact graph (Graph 1, TASK-168) share one
  vocabulary. Do not invent a second scheme.
- **Precedent already in the schema:** `ProfessionalSkillItem` carries per-field stale flags
  (`context_stale`, `positioning_stale`, `schema.ts:189/191`) and a `depthSource: 'corrected'`
  no-overwrite rule. Field-level staleness is not novel here — Thread 3 generalizes an existing
  pattern.
- **Fingerprint convergence (Option C from Thread 1):** fingerprint-derived staleness only gains
  precision *if the fingerprint is scoped to the semantic input subset*. Because the prompt is
  the full identity, a naive "hash everything this section consumed" fingerprint degenerates back
  to full-context/all-stale. So Option C **requires** this thread's `inputs(section)` map to
  define what to hash. Thread 3 is the prerequisite for the robust fingerprint end-state.

## Non-goals

- No change to generators or what they put in the prompt (they stay full-context; this is a
  *staleness* model, not a prompt-scoping change).
- No leveling (Thread 2), no new triggers (Thread 1 owns those).
- No move to field-level (sub-section) staleness granularity in this thread — section-level DAG
  first; field-level is a later refinement that the `identityFields` vocabulary leaves room for.

## Open decisions

1. **Under-approximation tolerance.** Confirm we accept documented false negatives (e.g.
   "education edits don't flag positioning") in exchange for a trustworthy signal, with the
   inclusion rule as the contract. Recommend yes — a signal users trust beats a complete one they
   ignore.
2. **Edge validation pass.** Each edge in the table is validated against its generator's prompt
   instructions during implementation; treat the table as proposal, prompts as truth.

## Implementation gates

`facet-architecture-guard` (evidence-vs-narrative: the DAG must keep evidence upstream of
narrative — note `chapters` is authored-from-roles, never derived).

---

## Implementation notes (as built, 2026-06-11)

Landed in `src/routes/identity/identityInferenceDependencies.ts`. The module now encodes the DAG
as a **material-inputs (upstream) adjacency** (`IDENTITY_INFERENCE_INPUTS`); downstream is its
transitive transpose. `getDownstreamIdentityInferenceSections` keeps its signature, so both
consumers — `identityStore.recordIdentityCorrection` (the Thread 1 cascade) and
`IdentityMapPage`'s downstream-regenerate prompt — got sharper output with no call-site change.

**The as-built DAG (upstream inputs):**

| Section | Inputs | Downstream (transpose closure) |
|---|---|---|
| bullets | — | everything |
| skills | bullets | thesis, profiles, selfKnowledge, positioning, search |
| thesis | bullets, skills | profiles, selfKnowledge, positioning, search |
| profiles | bullets, skills, thesis | **— (leaf)** |
| chapters | bullets | selfKnowledge, positioning, search |
| selfKnowledge | bullets, chapters, thesis | positioning, search |
| positioning | bullets, skills, thesis, chapters, selfKnowledge | search |
| search | skills, thesis, chapters, selfKnowledge, positioning | — |

**Forward-only rule (resolves Open decision #2).** The generators are full-context, so a prompt
like the thesis generator's lists `profiles`/`self_model` as evidence even though those are
authored *later*. Those are pre-existing-context refinements, not derivation edges — encoding
them would make the graph cyclic and reintroduce the linear chain's paranoia ("correct your moat
→ thesis stale"), which contradicts the user's mental model. So every input precedes its section
in `IDENTITY_INFERENCE_ORDER` (enforced by test). This is what removes the headline false
positive: **`chapters` is downstream of `bullets` only** — editing thesis/skills/profiles no
longer flags the career arc.

**Two contested edges, decided:**

- **`profiles` is a downstream leaf** (user-confirmed). The selfKnowledge/positioning prompts do
  name `profiles` as evidence, but it is a sibling presentation lens, not a primary driver of the
  narrative — matching this design's table, which omits `profiles` from every input list. Cost:
  it cascades to nothing, so the `IdentityMapPage` cascade-machinery tests (which used `profiles`
  as a convenient trigger) were re-pointed onto `selfKnowledge`, the only async-mockable non-leaf
  non-draft-review source.
- **`selfKnowledge` is *not* a leaf.** The bare `self_model` input listed for `positioning` and
  `search` resolves (in part) to `self_model.philosophy`, which `selfKnowledge` owns — so it feeds
  both. This preserved the existing "regenerate self-knowledge → downstream prompt" behavior.

**Field-path vocabulary (the TASK-168 convergence).** `IDENTITY_INFERENCE_SECTION_FIELDS` maps
each section to the dotted identity paths it owns (`skills`, `self_model.arc`,
`self_model.competitive_moat`, …) in the same string vocabulary as `artifactMeta.identityFields`.
Two pure helpers ride on it: `getIdentityInferenceSectionForField(path)` (prefix-matched reverse
lookup bridging a Graph 1 mutation field into a Graph 2 section — `identity.name` and `expertise`
correctly resolve to nothing) and `getIdentityInferenceInputFields(section)` (the upstream owned
fields, i.e. the `inputs(section)` set the Option C fingerprint must hash so it does not degrade
to the full identity). The fingerprint itself is not computed here — Thread 3 is its prerequisite,
not its delivery.
