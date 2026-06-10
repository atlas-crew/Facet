# Thread 3 — Inference Dependency Graph: Linear Chain → DAG Precision

**Status:** Design (2026-06-10). Thread 3 of the roadmap in
[`identity-derivation-graph-reframe-and-roadmap.md`](./identity-derivation-graph-reframe-and-roadmap.md).
Design only.

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
