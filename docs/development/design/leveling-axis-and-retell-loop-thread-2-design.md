# Thread 2 — Leveling Axis & Re-tell Loop (Spine)

**Status:** Spine settled; **UX resolved 2026-06-13** — Thread 1 (#36) shipped and Thread 3 (#37)
landed, so the correction→cascade is now observable. Thread 2 of the roadmap in
[`identity-derivation-graph-reframe-and-roadmap.md`](./identity-derivation-graph-reframe-and-roadmap.md).
The taxonomy (open decision #1) is settled as the **five-level ownership ordinal**; the re-tell
elicitation UX is designed below ("UX — Re-tell elicitation"). Remaining work is build only
(schema → graph → generator → UI).

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
// Settled 2026-06-13 — abstract scope-of-ownership ordinal, low → high.
type ProfessionalBulletLevel = 'executes' | 'owns' | 'shapes' | 'defines' | 'pioneers'

// ProfessionalRoleBullet (schema.ts:250) — additive, all optional
level?: ProfessionalBulletLevel              // the scope/seniority the work demonstrates
level_source?: 'inferred' | 'corrected'      // mirrors depthSource; 'corrected' ⇒ regeneration must not overwrite
level_confidence?: 'high' | 'medium' | 'low' // mirrors depthConfidence
level_rationale?: string                     // the surfaced assumption ("reads as system-scope because…")
```

- **`ProfessionalBulletLevel` taxonomy — settled 2026-06-13.** An **abstract scope-of-ownership
  ordinal**, not a company title-ladder (Facet spans professions per the business model; ladders
  don't generalize): `executes → owns → shapes → defines → pioneers` — the work executed a defined
  task / owned a component end-to-end / shaped a system's design / set direction others follow /
  influenced beyond the org. The fifth rung (`pioneers`) is the staff+/principal top end the
  four-level candidate lacked; an ordinal, so re-tell can step a bullet up or down one register.
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

## UX — Re-tell elicitation (resolved 2026-06-13)

The cascade is now live and inspectable: `recordIdentityCorrection(section)` flags
`staleInferenceSections` (tier-1 persist), which surfaces through the `downstreamPrompt` dialog and
per-section **Refresh** actions in `IdentityMapPage`. Thread 3's DAG is precise ("precise, not
paranoid"). With both observable, the four deferred questions resolve — and the cascade surfaces one
concrete finding that promotes an earlier recommendation to a requirement (see ⚠️ below).

### 1. Surfacing aggressiveness — signal-gated, never a blanket sweep

- **On-demand, always:** "Re-tell" is a sibling button to "Deepen" on `BulletInspector`, available
  whenever the bullet has PAIO (mirror deepen's gate + single-flight `anyOtherDeepenRunning`).
- **Proactive only on a named signal:** surface a nudge iff `level` is absent, or
  `level_source === 'inferred' && level_confidence === 'low'`. No sweep over "every thin bullet" —
  that reads as a completeness chore and violates principle #8. The nudge names *why* ("I wasn't
  sure how to level this one"), never "improve your profile" (#1, #7).

### 2. Placement — inline primary; the calibration pass is an aggregation, not a subsystem

- **Primary home is inline** on `BulletInspector`, beside Deepen — the evidence and the deepen
  affordance already live there, and #4 says surface the correction where the user already is.
- **Secondary, opt-in "Calibration pass":** lists the bullets carrying a proactive signal and walks
  them one at a time. It is an *aggregation view over the same inline mechanism* — it reuses the
  existing batch-review pattern (the `downstreamPrompt` dialog / stale-artifact review), not a
  second code path. No standalone modal; re-tell is inline edit + one-click confirm (#7).

### 3. Copy — name the scope as a question, one click to confirm or step it

The surfaced assumption states the assigned level in plain scope language + rationale, as a question:

| level | prompt |
|---|---|
| `executes` | "This reads as **executing a defined task** — right?" |
| `owns` | "This reads as **owning a component** end-to-end — right?" |
| `shapes` | "This reads as **shaping a system's design** — right?" |
| `defines` | "This reads as **defining direction others follow** — right?" |
| `pioneers` | "This reads as **influence beyond the org** — right?" |

- Each shows `level_rationale` ("…because you owned the rollout and on-call, not just the change").
- Controls: a confirm and a 5-stop scope stepper to recalibrate. Correcting writes `level` +
  `level_source: 'corrected'` + the user's note as `level_rationale`. No save/cancel modal (#7).
- Re-told **phrasings** (resume-register sentences) render like `DeepenEvidence` (summary +
  candidate rewrites) but are explicitly labelled *presentation, not facts* — they map to the
  assembly text-variant system; the durable artifact is `level` + `level_rationale`. This is the
  evidence-vs-narrative guardrail made visible: the re-tell reframes scope language over the same
  PAIO and **never** edits `problem`/`action`/`impact`/`outcome` or `source_text`.

### 4. One-at-a-time by default; batch is the opt-in pass

Inline = one bullet at a time (matches deepen). The calibration pass walks one-at-a-time *within* a
sweep with next/skip — **not** bulk auto-accept. Each level is the highest-signal calibration the
system gets (the thread's whole premise); accepting a screenful blind defeats the purpose. #8 says
prioritize high-impact corrections — this *is* the high-impact one, so it earns a deliberate click.

### Show downstream impact — reuse the existing cascade dialog (#3)

A level correction records against the `leveling` region and rides the **existing**
`downstreamPrompt` dialog — the same "this flagged thesis / positioning / search; refresh?"
affordance every other inference correction uses. No new impact UI. The message is *precise* rather
than paranoid precisely because `leveling` is its own region (⚠️ below): "recalibrating to
**owns**-scope updates your thesis and positioning — not your skill depths."

### ⚠️ Over-fire finding — `level` must be its own cascade region (now observable)

The design gated this UX on the over-fire rate being observable once Thread 1 shipped. It is, and
the finding promotes open decision #2 from *recommended* to *required*, with a mechanism:

A bullet `level` correction must **not** route through the coarse `bullets` field-region
(`IDENTITY_INFERENCE_SECTION_FIELDS.bullets = ['roles', 'projects']`). If it did, one level
recalibration would flag *everything* downstream of `bullets` stale — including `skills` (depth) and
`chapters` (career arc), neither of which consumes level. That is exactly the paranoid over-fire
Thread 3 was built to kill.

Resolution:

- Add **`leveling` as the 9th inference section**, ordered after `skills`, before `thesis`. Inputs
  `['bullets', 'skills']`; add `leveling` to the inputs of `thesis`, `positioning`, `search`. The
  forward-only invariant holds (inputs precede it; consumers follow). The candidate-level rollup in
  `self_model` is this section's generated output.
- `BulletInspector` re-tell calls **`recordCorrection('leveling')` directly** — the store API takes a
  section enum (as `ThesisInspector` → `recordCorrection('thesis')` and `BulletInspector` →
  `recordCorrection('bullets')` already do). Direct section recording sidesteps the field-path
  resolver entirely, so a per-bullet level edit fires only `leveling`'s downstream
  (thesis / positioning / search), never `skills` / `chapters`.
- **Field-path caveat (programmatic/import only):** `getIdentityInferenceSectionForField` returns
  the first prefix match in inference order, so `roles[].bullets[].level` would resolve to `bullets`
  (via the `roles` root) before a later `leveling` is reached. The inline flow never hits this path.
  Only if a bulk import sets levels does this matter — then switch the resolver to most-specific-wins
  or give `leveling` an explicit `roles.*.bullets.*.level` root with longest-match precedence. Flag
  for the schema/graph PR; not required for the inline re-tell.

### Build order implied by this UX (next turn)

1. **Schema** — `level` / `level_source` / `level_confidence` / `level_rationale` on
   `ProfessionalRoleBullet` (additive, no migration); `ProfessionalBulletLevel`; candidate-level
   rollup in `self_model` (generated, corrigible — sibling of `competitive_moat`).
2. **Graph** — add `leveling` to `IDENTITY_INFERENCE_ORDER` + labels + inputs + fields + the
   consumer edges (type-guided by the `satisfies Record<…>` constraints).
3. **Generator** — `retellIdentityBullet`, sibling of `deepenIdentityBullet`.
4. **UI** — re-tell affordance on `BulletInspector`; optional calibration pass.

## Open decisions

1. ~~**`ProfessionalBulletLevel` taxonomy**~~ — **settled 2026-06-13**: five-level ownership ordinal
   `executes → owns → shapes → defines → pioneers`.
2. ~~**Dedicated `leveling` section vs. folded**~~ — **settled 2026-06-13**: dedicated, now *required*
   (not just recommended) — folding `level` into `bullets` over-fires into `skills`/`chapters`. See
   the ⚠️ over-fire finding above for the mechanism.
3. ~~**Role-level rollup**~~ — **settled 2026-06-13**: *derive*. No `level` field on
   `ProfessionalRole`; role-level scope is computed at generation time from the role's bullet
   `level`s when a consuming generator needs it. The bullet `level` is the only persisted truth on
   the evidence side; the candidate-level rollup stays in `self_model` as generated narrative
   (corrigible, sibling of `competitive_moat`). A persisted role aggregate would be a third copy of
   the same signal that silently drifts from the bullets the moment one is re-told — the exact
   evidence-vs-narrative collapse the thread is built to avoid.

## Implementation gates

`facet-architecture-guard` (evidence-vs-narrative is the core constraint here),
`facet-persistence-changes` (new optional bullet fields + self_model rollup),
`facet-assembly-engine` (re-told phrasings → text-variant reuse).
