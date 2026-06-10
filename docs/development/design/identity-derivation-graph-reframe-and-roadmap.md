# Identity Derivation Graph — Reframe & Roadmap

**Status:** Design capture (2026-06-10). Originated from a working session re-examining
whether the Identity Import page (`/identity/import`) should collapse into the Identity
Map (`/identity`).

**One line:** The map is not an editing surface bolted onto an extraction page — it is a
*second generation surface*. There is one identity derivation graph with two feed points,
and the product job is to make that graph visible and correction-driven.

---

## How we got here

The triggering question was a UI one: *now that the map can edit most of the model, should
we fold Import into a drawer and keep only the input sources?*

Tracing the code answered the UI question but exposed a deeper one. The map/import split was
never view-vs-edit:

- **Import** (`/identity/import`, `IdentityPage.tsx`) does **first-pass bulk synthesis** —
  `generateIdentityDraft` turns sources into a whole model, staged as a `draft` before
  `applyDraft` commits it to `currentIdentity`.
- **Map** (`/identity`, `IdentityMapPage.tsx`) does **incremental section regeneration with a
  cascade** — eight inference sections (`IDENTITY_INFERENCE_ORDER`), each individually
  regeneratable, with a "Potentially stale → Regenerate all stale" panel and a
  downstream-prompt modal.

Both write the identity *by inference*. You cannot "remove building from one surface" because
the other surface is also building. The thing worth unifying is not the pages — it is the
**derivation graph**. The pages are two feed points into it (bulk and incremental). Once the
map visibly *is* the graph, the import/map merge becomes nearly cosmetic and falls out for
free.

This reframes the original UI question: don't spend the move relocating a form. Make the graph
correction-driven and visible; page consolidation is the cheap last step.

---

## Two staleness graphs, one mechanism

There are **two distinct dependency graphs** in the system today. They are siblings — both are
"X changed → downstream is stale" — and they should share one mechanism, not grow into three
incompatible ones.

### Graph 1 — identity → downstream artifacts (partially designed)

Skill depth → cover letters / prep / search / resume; vectors → search thesis / resume; etc.
This is already sketched in
[`shepherding-design-extraction-loops-correction-flow-architecture.md`](./shepherding-design-extraction-loops-correction-flow-architecture.md)
("The Dependency Graph (Impact Tracing)" + "Cross-Cutting: Fresh-Context Critique Triggers"),
and `src/types/artifactMeta.ts` already reserves the mechanism: `identityFields[]` and
`identityFingerprint` per artifact, with `describeImpact` for field-level matching (TASK-168,
not yet fully populated).

### Graph 2 — intra-identity inference (built, but blunt and untriggered)

Within the identity model, evidence sections feed narrative sections. This is
`src/routes/identity/identityInferenceDependencies.ts`:

```
bullets → skills → thesis → profiles → chapters → selfKnowledge → positioning → search
```

It exists, but with two limitations (both verified in code):

1. **It is a linear over-approximation, not a DAG.** Each node depends only on its immediate
   successor; downstream is computed transitively. The file comment is explicit: *"over-warn
   about stale inference rather than hide a possible invalidation."* Real edges fan out
   (bullets feed skills *and* thesis *and* positioning *and* search), so the chain trades
   precision for guaranteed-conservative warning — at the cost of false-positive staleness.

2. **It is regeneration-triggered, not correction-triggered.** Every
   `markStaleInferenceSections` call in `IdentityMapPage.tsx` sits inside the regenerate /
   cascade flow (`runQueuedInferenceSections`, `runDownstreamRegenerationPlan`, the
   cascade-settle effect). A **manual correction in an inspector marks nothing stale.** And the
   stale set is `useState` on the page — ephemeral, lost on reload/navigation.

### The reconciliation

Graph 2's "correct a bullet → narrative downstream goes stale" is the intra-identity
counterpart of Graph 1's "correct a skill depth → cover letter goes stale." Both want the same
primitive: *recorded input fingerprint at generation time ≠ current input fingerprint ⇒ stale.*
The `identityFingerprint` concept reserved for Graph 1 (TASK-168) is the same concept Graph 2
needs. **Design them to share the fingerprint/field-dependency vocabulary** so we end with one
staleness mechanism applied at two altitudes, not two bespoke ones.

---

## The "lost" principle, located

The principle the session flagged as possibly lost — *correction is easier than a blank text
box; surface assumptions clearly and let the user correct them* — is not lost. It is the core
of the shepherding doc (Principle #3 "Show Downstream Impact Immediately"; Principle #6
"Fresh-Context Critique Is a Feature"). What is **missing in the running product** is the wiring
that makes a correction on the map actually light up downstream impact — i.e. Graph 2 being
correction-triggered. Thread 1 below is that wiring.

The half that *is* built: assumption-surfacing for **facts**. The extraction prompt carries a
confidence ladder (`confirmed` = stated in 2+ source variants, `stated` = 1, `guessing` =
inferred from none; `src/utils/identityExtraction.ts`), surfaced by `BulletConfidenceCard`.

---

## The unreliable-narrator / leveling layer

Second insight from the session: the user (and the resumes they authored) is an **unreliable
narrator** who may be under- or over-leveling themselves — sometimes aware their language
undersells, sometimes genuinely not realizing they operate above their self-assessed level.
*Re-tellings of a bullet surface the true level; corrections to the re-telling are the
highest-signal calibration input we get.*

This is **not** new to the docs — it is scattered through the shepherding doc as "calibration"
(Stage 1 "level-correction may be embedded" in the AI export; Stage 2 "semantic skill depth …
the most important extraction"; Stage 5 `SkillGroup.calibration = "builds around K8s, not a K8s
admin"`). What is missing is making **level a first-class axis** rather than scattered
calibration prose, and building the **re-tell loop** that elicits and corrects it.

Two things that must stay distinct:

| Axis | Question | Status |
|---|---|---|
| **Confidence** | *Did this happen?* (fact certainty) | Modeled — variant-agreement ladder |
| **Level** | *How senior is what happened?* (scope/seniority) | **Not modeled anywhere** in the identity schema (verified: no seniority/level field) |

A bullet can be `confirmed` (definitely happened) while its *leveling* is wrong. Conflating the
two would corrupt both signals.

**Architectural guardrail (evidence-vs-narrative commitment):** level is *interpretation*, not
evidence. It lives on the narrative side (like the Self Model arc), layered on top of bullet
evidence, and is **never** written back into the evidence text. The existing chain already
encodes this — evidence (`bullets`, `skills`) is upstream; narrative (`thesis`, `positioning`)
is downstream. Leveling slots in as a downstream-of-evidence interpretation.

**Why it's the same machine as Thread 1:** a leveling correction is an edit at the top of the
derivation graph (evidence), which cascades staleness to the level-sensitive narrative layers
(thesis, positioning, search). Build the correction→cascade wire once (Thread 1) and the
leveling loop rides on it.

---

## Roadmap — three threads

| # | Thread | What | Size | Depends on |
|---|---|---|---|---|
| **1** | **Correction-driven staleness** | Wire inspector edits into Graph 2; persist the stale set; corrections now cascade. | Small — mostly wiring against existing chain | — |
| **2** | **Leveling re-tell loop** | First-class `level` interpretation axis + a "re-tell at calibrated register" mode on the deepen machinery + surface-and-correct UI. Rides Thread 1's cascade. | Large — the differentiated product bet | Thread 1 (cascade), benefits from Thread 3 |
| **3** | **Graph precision (line → DAG)** | Replace the conservative linear chain with real consumption edges so staleness is precise, not paranoid. | Medium — quality-of-life; makes 1 and 2 quiet enough to trust | — |

**Sequencing: 1 → 3 → 2.**

- **1 first** because it is the user's actual ask, it is small, it is independent, and it
  unblocks the rest. Detailed design:
  [`correction-driven-inference-staleness-thread-1-design.md`](./correction-driven-inference-staleness-thread-1-design.md).
- **3 second** because once corrections drive the cascade, a noisy linear chain that cries
  "everything's stale" after every edit trains the user to ignore the signal. Precision matters
  more the moment edits (not just regenerations) feed it.
- **2 last** because it is the largest and the one worth getting right; it depends on the
  cascade (1) and reads far better on precise edges (3). It is also the only one that is
  genuinely differentiated.

**Page consolidation (the original UI question)** is *after* all three, and falls out for free:
import becomes "bulk feed," the map is "the graph."

**Per-thread design notes:**
[Thread 1](./correction-driven-inference-staleness-thread-1-design.md) ·
[Thread 3](./inference-dependency-graph-dag-precision-thread-3-design.md) ·
[Thread 2 (spine)](./leveling-axis-and-retell-loop-thread-2-design.md).

**Cross-thread note (surfaced designing Thread 2):** Thread 2 may add a 9th `leveling` node to
`IDENTITY_INFERENCE_ORDER`. Threads 1 and 3 must therefore keep the section set **open** — the
persisted stale set is keyed by the enum (already open), and the Thread 3 DAG is adjacency data
that admits new nodes. Do not hard-code "exactly 8 sections" anywhere.

---

## Guardrails carried into every thread

- **Evidence vs. narrative** — corrections to evidence (bullets/roles/skills) may re-derive
  narrative (thesis/positioning); narrative is never collapsed back into evidence. Level is
  narrative.
- **Identity-canonical-data** — staleness/refresh operates on the canonical `currentIdentity`;
  derived artifacts (resume, LinkedIn, cover letters) mirror it and are governed by Graph 1, not
  re-derived independently.
- **One mechanism** — Graph 1 (identity→artifact) and Graph 2 (intra-identity) share the
  fingerprint/field-dependency vocabulary; do not grow a third staleness system.

---

## References

- Code: `src/routes/identity/identityInferenceDependencies.ts` (Graph 2 chain),
  `src/routes/identity/IdentityMapPage.tsx` (stale panel, regenerate cascade, edit inspectors),
  `src/store/identityStore.ts` (`updateCurrent*` edit surface), `src/types/artifactMeta.ts`
  (`identityFields` / `identityFingerprint`, TASK-168), `src/utils/identityExtraction.ts`
  (confidence ladder, deepen machinery).
- Design: [`shepherding-design-extraction-loops-correction-flow-architecture.md`](./shepherding-design-extraction-loops-correction-flow-architecture.md)
  (correction principle, impact-tracing, calibration), and the identity-canonical-data /
  evidence-vs-narrative commitments in `docs/architecture/`.
