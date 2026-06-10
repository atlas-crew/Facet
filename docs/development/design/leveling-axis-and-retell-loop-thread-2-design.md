# Thread 2 — Leveling Axis & Re-tell Loop (Spine)

**Status:** Design — **spine only** (2026-06-10). Thread 2 of the roadmap in
[`identity-derivation-graph-reframe-and-roadmap.md`](./identity-derivation-graph-reframe-and-roadmap.md).
The **UX / elicitation section is intentionally deferred** until Thread 1 ships and the
correction→cascade is observable in practice (see "UX — pending Thread 1 feedback"). This note
settles the load-bearing schema and graph decisions that ripple back into Threads 1 and 3.

**One line:** Make *level* (seniority/scope) a first-class **interpretation** axis on bullet
evidence, with a **re-tell** loop — a sibling of bullet deepening — that surfaces the assumed
level and lets the user correct it; corrections ride Thread 1's cascade.

---

## The insight (recap)

The user and their authored resumes are an **unreliable narrator** who may under- or over-level
themselves. Re-tellings of a bullet surface the true level; the user's correction to a re-telling
is the highest-signal calibration input the system gets. Full framing in the roadmap note ("The
unreliable-narrator / leveling layer").

## Level ≠ confidence (orthogonal axes)

| Axis | Question | Status today |
|---|---|---|
| **Confidence** | *Did this happen?* | Modeled in extraction (variant-agreement ladder confirmed/stated/guessing); **not persisted on the bullet** — `BulletConfidenceCard` reads the draft. |
| **Level** | *How senior is what happened?* | **Not modeled at all.** |

A bullet can be `confirmed` while mis-leveled. Keep the axes separate in schema and UI.

---

## Schema placement (the load-bearing decision)

**Anchor `level` on the bullet** — the bullet is where re-tellings operate, and the finest grain
at which scope is demonstrable. Mirror the **proven skill-depth provenance pattern** exactly
(`ProfessionalSkillItem.depth` / `depthSource` / `depthConfidence`, `schema.ts:176-188`), which
already encodes "user correction > schema value > AI inference; `corrected` must not be
overwritten by regeneration."

```ts
// ProfessionalRoleBullet (schema.ts:250) — additive, all optional
level?: ProfessionalBulletLevel              // the scope/seniority the work demonstrates
level_source?: 'inferred' | 'corrected'      // mirrors depthSource; 'corrected' ⇒ regeneration must not overwrite
level_confidence?: 'high' | 'medium' | 'low' // mirrors depthConfidence
level_rationale?: string                     // the surfaced assumption ("reads as system-scope because…")
```

- **`ProfessionalBulletLevel` taxonomy — open decision.** It must be an **abstract scope ordinal**,
  not a company title-ladder (Facet spans professions per the business model; ladders don't
  generalize). Candidate: a scope-of-ownership ordinal such as
  `executes → owns → shapes → defines` (the work executed a task / owned a component / shaped a
  system / set direction). Exact taxonomy is a product-defining choice — settle before build.
- **Candidate-level rollup is narrative, derived.** The person's overall operating level is an
  interpretation over bullet/role levels + skills, and belongs in `self_model` as an authored
  interpretation (sibling of `competitive_moat`, which the schema already documents as "authored
  narrative interpretation, snapshot at thesis time", `schema.ts:83-88`). It is **never** a raw
  field the user types; it is generated and corrigible.

**Additive + optional → no migration** (per the persistence rules). Run through
`facet-persistence-changes` at build.

## Evidence vs. narrative — the guardrail that defines this thread

Level is **interpretation of evidence, not evidence.** Three hard rules:

1. The re-telling **must not overwrite the bullet's factual PAIO or `source_text`.** It reframes
   emphasis/scope-language over the *same facts*; it never invents a new factual claim. The
   user's correction is what certifies the reframing is truthful.
2. `level_source: 'corrected'` blocks regeneration from overwriting the user's calibration —
   identical to the skill-depth rule already in the schema.
3. Re-told **phrasings** (the resume-facing sentence at a given register) are *downstream
   variants*, not identity edits — they map onto the existing **text-variant** system in the
   assembly engine (`facet-assembly-engine`). The durable identity artifact is the `level` +
   `level_rationale`; the alternative sentences are presentation, resolved per vector at assembly
   time. This keeps the canonical model clean and reuses machinery rather than duplicating it.

---

## Re-tell mechanism

`retellIdentityBullet` — a **sibling of `deepenIdentityBullet`** (`identityExtraction.ts`).
Deepen expands `source_text → PAIO`; re-tell takes the bullet's PAIO + a target level register
and returns: (a) candidate re-narrations at that register, (b) an assigned `level` + `confidence`
+ `rationale`. The user accepts/edits → writes `level` with `level_source: 'corrected'`.

It reuses deepen's plumbing (endpoint, abort handling, per-bullet progress) — this is a new
*mode*, not a new subsystem.

## Cascade hookup (Thread 1) and graph placement (Thread 3)

- A bullet `level` correction is an edit to the **bullets/roles evidence region** →
  `recordIdentityCorrection` marks the bullets' downstream consumers stale. Level-sensitive
  narrative — `thesis`, `positioning`, `search`, and the candidate-level rollup — re-derives.
  **Same machine as Thread 1; no second staleness system.**
- For the cascade to *see* level, Thread 3's field-path vocabulary must include
  `roles[].bullets[].level` as an output of the bullets region. Coordinate the field-path list.

### ⚠️ Cross-thread ripple — the reason to settle this now

The candidate-level rollup is a generated narrative. **Decision:** is "leveling" its own node in
`IDENTITY_INFERENCE_ORDER` (consuming `bullets` + `skills`, feeding `thesis`/`positioning`/`search`),
or folded into existing generators?

- A **dedicated `leveling` section** gives clean, precise cascade edges (recommended), **but it
  expands the `IdentityInferenceSection` enum** that Thread 1's persisted stale set and Thread 3's
  DAG are built on.
- This is exactly why the spine is designed now: **Threads 1 and 3 should reserve room for a
  9th section** rather than hard-code 8, so adding `leveling` later is additive, not a rework of
  the stale-set persistence and the DAG.

Recommendation: Thread 1 treats `staleInferenceSections: IdentityInferenceSection[]` as an open
set keyed by the enum (already true), and Thread 3 authors the DAG as adjacency data that admits
new nodes — both already hold if we avoid hard-coding "exactly 8" anywhere. Add a note to both
threads.

---

## UX — pending Thread 1 feedback (deferred)

Deliberately **not designed yet.** These depend on feeling the live cascade:

- How aggressively to surface re-tellings (every thin bullet? only low-confidence? only on
  demand?) — gated on whether correction-driven staleness over-fires in practice.
- Where re-tell lives (inline on the bullet inspector vs. a dedicated calibration pass).
- How the surfaced assumption reads ("this reads as system-scope — right?") — copy is a
  shepherding-principle #7 concern ("conversational, not bureaucratic").
- Batch vs. one-at-a-time correction flow.

Revisit once Thread 1 ships and the over-fire rate + the precision from Thread 3 are observable.

## Open decisions

1. **`ProfessionalBulletLevel` taxonomy** — the scope ordinal. Product-defining; settle before build.
2. **Dedicated `leveling` section vs. folded** — recommend dedicated (clean edges); requires
   Threads 1/3 to keep the section set open (see ripple above).
3. **Role-level rollup** — also store an aggregated `level` on `ProfessionalRole`, or derive
   role/candidate level purely at generation time? Recommend bullet-anchored truth + generated
   rollups (don't persist redundant aggregates that can drift).

## Implementation gates

`facet-architecture-guard` (evidence-vs-narrative is the core constraint here),
`facet-persistence-changes` (new optional bullet fields + self_model rollup),
`facet-assembly-engine` (re-told phrasings → text-variant reuse).
