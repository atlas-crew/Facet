# Identity Derivation Graph — Milestone Plan

**Status:** Active plan (2026-06-13). Epic: [#39](https://github.com/atlas-crew/Facet/issues/39).
**Supersedes** ad-hoc thread sequencing for execution purposes; the per-thread design notes
remain authoritative for *design*, this doc is authoritative for *order, gates, and contracts*.
**Origin:** the 2026-06-13 milestone multi-perspective analysis (and the prior Thread-2 design
analysis), which found the work-so-far had built inward-facing machinery (Graph 2) and deferred
every outward-facing payoff (Graph 1, a terminal state, the differentiated leveling loop).

---

## The convergence invariant

> **Every increment ends in a behavior a user can see, and adds no prioritizer to a workspace
> that has no terminal state.**

This is the anti-divergence rule. The milestone already diverged *with* design docs present —
not from too little planning, but because the plan was organized around *internal mechanism*
(Graph 2 threads) with no per-increment definition of done. The locally-obvious next move is
always "deepen the substrate"; this invariant exists to override that. If a proposed increment
does not end in a visible user behavior, it is mis-scoped — re-cut it until it does.

Two corollaries, each load-bearing:

- **Visible-behavior-first.** Precision of an unobserved signal is the pre-launch trap. Prefer the
  cheapest slice that turns an evidence edit into a change the user can perceive.
- **No new always-on panel.** The host workspace (the Identity Map) already runs 2–4 competing
  "what's next" engines with no "done" (M11 finding H1/C1). Every new signal — stale, attention,
  leveling — renders **through the unified queue** (see *Shared-surface contract*), never as a
  fresh parallel panel.

---

## Where the milestone stands

| Work | Status | Layer |
|---|---|---|
| #40 Identity as first-class workspace artifact | ✅ shipped | persistence |
| Thread 1 (#36) correction-driven staleness | ✅ shipped | Graph 2 (intra-identity) |
| Thread 3 (#37) linear chain → consumption DAG | ✅ shipped | Graph 2 precision |
| Thread 2 (#38) leveling re-tell | 🟡 design resolved; build phased (below) | the differentiated bet |
| Graph 1 (#63) identity → artifact staleness | ⚪ filed; reserved scaffolding, no writer/reader | the user-visible payoff |
| #41 privacy + encryption-at-rest | ⚪ open | platform gate (hosted only) |
| Page consolidation (Import → Map) | ⚪ not started | UI, "cheap last step" |
| M10 (#42–47) · M11 (#48–62) review debt | ⚪ 21 open | host-workspace polish |

**The diagnosis in one line:** Graph 2 is live but produces staleness *inside* the identity
workspace with no downstream payoff (Graph 1 dark) in a workspace with no "done" (C1). The
milestone's one shipped user-facing behavior — staleness — currently reads as **noise without
payoff**. The next increment's job is to make an *existing* cascade pay off, not to add a new one.

---

## Phases (execution order, gates enforced in `gh`)

Ordering principle: smallest-visible-loop first; substrate only when a payoff needs it. The
`blocked_by` edges below are real GitHub dependencies, so `gh seq` refuses to surface a phase as
startable until its prerequisites close. **Do not start a wave-2 item while wave-1 is open.**

### Phase 0 — Give the workspace a "done" *(wave 1: #48, #49)*
**Goal (visible behavior):** a first-run user reaches an unambiguous "research-ready → Continue"
state and is never met by competing prioritizers.
- **#48 (C1):** add the research-ready terminal state + "Continue to Research" CTA, derived from
  the signals the action ladder already computes (`hasThesis`/`hasPositioning`/`hasSearchStrategy`
  / zero-pending). On both the Map and the enrichment completion state.
- **#49 (H1):** unify the 2–4 prioritizers into **one queue** (or subordinate "Needs attention"
  to "Next action"); stale/attention/leveling all render as queue items per the contract below.
- **Fold in (Thread-2-adjacent ergonomics, same surfaces):** H2 (#50 inspector focus-return +
  explicit close), M3 (#54 explain disabled), E2 (#59 even empty-state CTAs).
**Exit criterion:** the Map has a single prioritized queue and a terminal state the user can reach
*and leave from*. **Gate:** the queue must implement the *Shared-surface contract* — Phase 1
renders into it, so its shape is frozen here.

### Phase 1 — Thinnest leveling loop, self-contained *(wave 2: #38)*
**Goal (visible behavior):** the user re-tells a bullet, corrects its level, and the inspector
reflects the corrected level back — a complete loop that does **not** depend on Graph 1.
- **Schema:** `level` / `level_source` / `level_confidence` / `level_rationale` on
  `ProfessionalRoleBullet` + `ProfessionalBulletLevel = 'executes' | 'owns' | 'shapes' |
  'defines' | 'pioneers'`. Additive, no migration.
  - **Correction (from prior analysis): re-anchor `pioneers`** on the ownership frame ("direction
    adopted beyond your own org"), not an impact frame — keep it a scope rung. Validate all five
    rungs against **one non-engineering persona** (a litigator's matter, a clinician's protocol)
    before they enter the generator prompt.
- **Generator:** `retellIdentityBullet`, sibling of `deepenIdentityBullet`. Writes `level` +
  `level_rationale`. **Re-told sentences are ephemeral preview** — *not* persisted variants.
  (`assembler.ts` `resolveTextVariant` keys on `selectedVector`, not level register; the earlier
  "maps to the text-variant system" claim is contradicted by the code. Durable artifact = `level`
  + rationale only.)
- **UI:** inline "Re-tell" affordance on `BulletInspector` (sibling of Deepen) **+ the inspector
  displays `level` back** (the reader that keeps the field from being dead weight) + direct
  `recordCorrection('leveling')`. `level_confidence` **gates the nudge, never renders as a badge.**
- **Out of scope for Phase 1:** the `leveling` rollup node, the calibration pass, role-level
  derivation (no consumer exists — YAGNI), Graph-1 wiring.
**Exit criterion:** one real correction loop you can watch fire. **Gate:** decide Phase 2's fork
(below) *on that observed loop*, not before.

### Phase 2 — Make a cascade pay off *(wave 3: #63; fork decided on Phase 1 evidence)*
**Goal (visible behavior):** a correction visibly changes something downstream. Pick the cheaper:
- **2a — leveling rollup (stays in Graph 2):** add the `leveling` inference node (inputs
  `bullets`+`skills`; feeds thesis/positioning/search) so a level correction re-derives narrative.
- **2b — Graph 1 first lightup (#63, recommended):** populate `identityFields` on *one* generator
  (cover letter) and read `identityFingerprint` on identity change, so a correction flags *that
  artifact* stale. Proves the outward promise and makes Thread 1's existing cascade mean something.
**Gate:** this is an explicit decision point. Do not pre-design either fork before Phase 1 lands.
The thread's premise ("re-tell corrections are the highest-signal input") is unproven; planning
Phase 2 in detail now is BDUF on a guess.

### Phase 3 — Platform & consolidation *(deferred, correctly)*
- **#41 privacy + encryption-at-rest** — required before *hosted sync*, not before local Phase
  0–2. Sequence with the hosted-mode milestone, not this one.
- **Page consolidation** (Import → Map) — the roadmap's "cheap last step"; only after the Map is
  the legible, terminal-stated graph Phase 0 makes it.
- **Independent review debt** (M1/#52 keyboard nav, E1/#58 aria, E4/#61 aria-label, M10/#42–47 CSS
  token scale) — a separate a11y/polish pass, not entangled with Thread 2's surfaces.

---

## Dependency map (encoded in `gh`, read by `gh seq`)

```
wave 1   #48 (C1 terminal state)   #49 (H1 unify engines)        ← startable now
            └──────────┬───────────────┘
wave 2              #38 (Thread 2 leveling)   [blocked_by #36✓ #48 #49]
                        │
wave 3              #63 (Graph 1 lightup)     [blocked_by #38]
```

`#38 blocked_by #48, #49` encodes "the leveling **UI** cannot land until the workspace has a queue
and a done-state." The schema/generator half of #38 *may* proceed in parallel; the gate is on the
surface. `#63 blocked_by #38` encodes the Phase-2 evidence gate.

---

## Shared-surface contract — the unified Map queue

Frozen in Phase 0 (#49) because Phase 1 (#38) renders into it. All "what's next" signals become
one item type; no signal gets its own always-on panel.

```ts
type IdentityQueueKind = 'next-action' | 'attention' | 'stale' | 'leveling'

interface IdentityQueueItem {
  id: string
  kind: IdentityQueueKind
  title: string                  // human imperative: "Re-tell this bullet's level"
  rationale?: string             // the surfaced assumption: "reads as owns-scope because…"
  target: { band: string; entityId: string }  // where it lands on the canvas
  priority: number               // single ordering across all kinds
  resolve(): void                // scroll+open inspector / run inference / start re-tell
  dismissable: boolean           // can be cleared without acting (respects shepherding #8)
}
```

Contract rules (each maps to a finding):

1. **One queue, not N panels.** `deriveIdentityActions`, `deriveIdentityAttentionItems`, the stale
   set, and leveling nudges all produce `IdentityQueueItem[]` merged into one prioritized list.
   *(Resolves H1.)*
2. **Empty queue + readiness = terminal state.** When the queue is empty and the research-ready
   signals hold, render "research-ready → Continue to Research" — not another empty panel.
   *(Resolves C1.)*
3. **Leveling items resolve toward done.** Accepting a re-tell **removes** its queue item; it never
   spawns a new standing panel. *(Convergence invariant; UX-critic finding.)*
4. **`level_confidence` gates, never renders.** It decides whether a `kind:'leveling'` item appears
   (`level` absent, or `inferred` + `low`); it is never shown as a number/badge. *(Thread-2
   finding; serves H1 by not adding visible axes.)*
5. **Nag-free.** No completeness score, no progress bar (shepherding #1). The queue shrinks as work
   is done; "never finished" (shepherding #5) and "has a reachable done-state" (C1) coexist — the
   model is never *finished*, but the workspace is never a *trap*.

---

## What we deliberately do NOT plan upfront

Planning these now is BDUF on an unvalidated hypothesis (the trap that caused half the drift):

- Phase 2's 2a-vs-2b internal design (gated on Phase 1 evidence).
- Re-tell aggressiveness beyond Phase 1's signal-gated inline nudge.
- The calibration-pass batch surface, the leveling rollup edges, role-level derivation.
- Page-consolidation mechanics.

Each is planned to a **gate**, not a **spec**.

---

## Tracking changes made (2026-06-13)

- Filed **#63** (Graph 1) as the previously-latent outward-cascade scope; sub-issue of #39,
  type=Feature, Area=Cross-cutting, Status=Backlog.
- Set native `blocked_by`: `#38 ← #48, #49`; `#63 ← #38` (joins the existing `#38 ← #36`).
- `gh seq` now reflects waves 1→2→3 above.

---

## References

- Milestone analysis & Thread-2 analysis: this session's multi-perspective passes (2026-06-13).
- Roadmap: [`identity-derivation-graph-reframe-and-roadmap.md`](../design/identity-derivation-graph-reframe-and-roadmap.md)
  ("Two staleness graphs, one mechanism").
- Thread 2 spine + resolved UX:
  [`leveling-axis-and-retell-loop-thread-2-design.md`](../design/leveling-axis-and-retell-loop-thread-2-design.md).
- UX/interaction review (C1/H1/H2/M3/E2):
  [`2026-06-identity-flow-ux-interaction-review.md`](../reports/2026-06-identity-flow-ux-interaction-review.md).
- Shepherding principles:
  [`shepherding-design-extraction-loops-correction-flow-architecture.md`](../design/shepherding-design-extraction-loops-correction-flow-architecture.md).
