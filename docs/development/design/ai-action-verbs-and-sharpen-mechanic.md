# AI Action Verbs and the Sharpen Mechanic

**Status:** Proposed — 2026-06-21
**Issue:** [#31 — Standardize AI-action button styling and labels site-wide](https://github.com/atlas-crew/Facet/issues/31)
**Related:** `docs/development/ui/facet-style-guide.md` (Buttons), `docs/architecture/decisions/adr-0005-resumes-and-letters-are-first-class-entities-with-snapshot-mechanism.md`, `docs/architecture/identity-canonical-data.md`, M12 UI Primitive Consolidation (the `Button` primitive)

## Problem

AI-action buttons are styled and labeled inconsistently across the app: the same
operation is blue on one screen and bordered-neutral on another, carries a
`Sparkles` icon here and nothing there, and is labelled "Regenerate",
"Re-generate", "Refresh", "Rerun", or "Re-generate with answers" interchangeably.
A mechanical audit (2026-06-21) found **~45 AI-action buttons across 14 files**
with no shared treatment — see [Audit](#audit).

The deeper problem #31 only half-saw: this was treated as *one* re-run verb with
inconsistent paint. It is not. There are **distinct AI operations** that differ in
what the model sees and how its prior work is framed — and collapsing them hides
the mechanic that makes the product's output improve.

## The core insight: three generation modes

AI operations on an artifact differ along two axes — **what prior content is in
the model's context**, and **how that content is framed**:

1. **Self-aware incremental.** Prior draft in context, framed as *"this is your
   draft; an input changed; update it."* The model knows it is iterating on its
   own work. Preserves edits, applies the delta. Conservative — and **anchors**
   (the failure mode: it defends and entrenches its prior choices).

2. **Fresh generation.** No prior draft at all. Generate from the upstreams from
   scratch. Zero anchoring, but discards whatever was good about the prior
   structure. The blunt "start over." **Heavy** — it re-derives everything (the
   most inference-expensive mode, relevant once usage is user-visible).

3. **Blind self-critique.** Prior draft in context, but framed as *"critique and
   improve this candidate's draft"* with **the authorship hidden.** The model
   evaluates it as a stranger's work.

### Why mode 3 is the quality engine

The improvement does not come from a blank slate (mode 2). It comes from
**stripping the authorship attribution.** A model shown its own work trends toward
consistency and defense ("this is fine, I wrote it"); the same model shown "review
this external draft" switches into critical evaluation and finds the weaknesses.
You get fresh *eyes* on the existing work without throwing the work away.

This is the product philosophy — *correction > creation; iterative passes produce
level-correction and depth* — operationalized as a prompt: **same content, no
authorship tag, ask for critique.** It is also the brand promise made literal: the
tagline is *"See yourself, sharpened,"* so the everyday quality action is named
**Sharpen**.

## The vocabulary

| Verb | Mode | Context + framing | Role | Scope |
|---|---|---|---|---|
| **Generate** | first-run | upstreams only, no prior | Create the artifact the first time | whole |
| **Sharpen** | blind self-critique (3) | prior draft shown as *external* work to critique | **The default "make it better."** The core mechanic. | whole |
| **Refresh** | self-aware incremental (1) | prior draft + upstream delta, "update yours" | Fold in an input change, preserve edits | whole |
| **Start over** | fresh generation (2) | upstreams only, prior discarded | Rare, **heavy**, obvious reset | whole |
| **Deepen** | additive enrichment | one item, add depth | Single bullet / skill / project | element |
| **Polish** *(deferred rename of "Refine")* | localized edit | one element, user feedback-driven | Reword/finish one piece | element |

The gem metaphor (the product is **Facet**; facets are cut gem faces) drives the
verbs: **Sharpen** cuts the facets, **Polish** brings up the shine on one.
"Refine" reads as metallurgy (refining ore) — the wrong mineral — so it is
renamed **Polish**, but that rename is *deferred* (a Letters-local label change,
not part of the core standardization; see [Implementation](#implementation)).
"Refresh" stays generic deliberately — it is doing honest work and over-theming
every verb gets cute.

## Decisions

- **Sharpen is the default verb**, not Regenerate. Most of the audit's
  "Regenerate"/"Refresh" buttons are everyday "make this better" actions → they
  become **Sharpen**. "Generate" survives only for true first-runs.
- **Start over is rare and visibly heavy.** It is the deliberate "throw it away
  and rebuild" escape hatch — de-emphasized, set apart from Sharpen, and the
  natural place to surface an inference-cost weight once usage is user-visible.
- **Refresh is the exception, not the default.** It exists only where there are
  real user edits to protect *and* an upstream change to fold in. Few surfaces.
- **The user does not pick the mechanic at generation time.** Exposing Sharpen vs
  Start over vs Refresh as a standing choice is a false choice — users reach for
  the one that *feels* safe and silently forfeit quality. The system picks the
  verb per surface + state; the user's control is **post-hoc** (see below).

## Two axes: quality vs safety

The decision that unlocked the above: **quality and safety are orthogonal.**

- **Quality axis** — which generation mode runs (Sharpen / Refresh / Start over).
  Chosen by what produces the best output for that surface, never by data-safety.
- **Safety axis** — **version history + rollback.** Always on. Decouples "try a
  regeneration" from "lose my work."

Once rollback exists, the data-safety reason for Refresh evaporates and **Sharpen
becomes safe to run confidently** — nothing is irreversibly lost. The user's
control is **time-travel after the fact** ("I liked v2, restore it"), not a verb
toggle before the fact. That sidesteps the false-choice trap entirely: the system
runs the good mechanic; the user curates via history.

## Version history & rollback

**What exists today (verified):** `resumeStore.snapshots: ResumeSnapshot[]` and
`coverLetterStore.snapshots: CoverLetterSnapshot[]` with `addSnapshot` /
`removeSnapshot`; `pipelineStore` creates resume + cover-letter snapshots. But per
ADR-0005 these are **apply-time immutability** records ("freeze exactly what I
submitted"), created when a pipeline entry transitions to `applied` — one frozen,
permanent record. Identity has a single-step AI undo (closed #30). **No
retention/prune logic exists anywhere.**

**What is new:** a navigable **revision stack** per artifact — snapshot before
each Sharpen/Start over/Refresh, retained for a window, user-browsable and
restorable. This is a different lifecycle from apply-time snapshots:

- Apply-time snapshots are permanent, legal-ish "what I sent" records.
- Revisions are an ephemeral, prunable undo stack.

Different lifecycles → they should **not share retention rules.** Lean toward a
separate revision model rather than overloading the existing `*Snapshot` types.

## Styling standard

One visual family for all AI actions: **the blue (`--accent-primary`) button with
a small leading icon** (#31's requirement). The gap this closes: the M12 `Button`
primitive's `primary` variant is **neutral** (`--text-primary` background), not
blue, and there is no AI treatment today — which is *why* "some are blue, some
aren't." Fix: add an **`ai` variant** to the `Button` primitive (blue + icon
slot), satisfying #31's "shared component/class to prevent drift" requirement and
folding into the M12 migration. Differentiate verbs by icon only:

| Verb | Icon (lucide) |
|---|---|
| Generate | `Sparkles` |
| Sharpen | `Sparkles` (or a dedicated mark) |
| Refresh | `RefreshCw` (one icon — today's code mixes `RefreshCw` and `RefreshCcw`) |
| Start over | `RotateCcw` (visually de-emphasized; not blue-primary) |
| Deepen | `Sparkles` / layers |

## Audit

Verified inventory, 2026-06-21 (~45 genuine AI-action buttons across 14 files;
agent findings were citation-verified, with color and verb misclassifications
corrected). Five inconsistency patterns:

1. **Same verb, two colors.** Deepen is blue in bands (`SkillsBand`,
   `ExtractionAgentCard`) but neutral in inspectors (`BulletInspector`,
   `ProjectInspector`). Regenerate is neutral in `ExtractionAgentCard`, blue in
   `IdentityMapPage`, ghost in research. Generate is blue everywhere except
   research (`ResearchPage` thesis = ghost).
2. **Staleness re-runs styled 3 ways, labelled 5+ ways:** "Regenerate all stale"
   (blue), "Refresh positioning" (neutral), "Depth changed - re-draft all fields?"
   (ghost, phrased as a question), "Refresh from Identity" / "Rerun with current
   Identity" (ghost).
3. **Two refresh icons:** `RefreshCw` (letters) vs `RefreshCcw` (research,
   `ExtractionAgentCard`) — opposite-spin icons for the same concept.
4. **Icons on ~⅓, absent on ⅔.** `Sparkles` on most band-level actions, nothing
   on most inspector-level actions.
5. **Five spellings of "re-run":** Regenerate / Re-generate / Re-generate prep /
   Re-generate with answers / Rerun — loading states diverge too (rests at
   "Regenerate", runs as "Refreshing…").

## Implementation

Two tiers, because Sharpen vs the other modes is a difference in the *generator
call*, not just the label.

**Tier 1 — vocabulary + styling (mechanical, = #31).** Label each button by its
*current behavior* (almost all are from-scratch today → mostly "Sharpen" once the
critique path lands, or honest "Regenerate"/"Start over" until then), collapse the
spelling variants, and move everything onto the shared `ai` Button variant with
one refresh icon. No generator changes. Folds onto the M12 button waves so the
treatment ships once and cannot re-drift.

**Tier 2 — make the modes real (feature work, per-surface opt-in):**
- Build the **Sharpen** generator path: a wrapper that feeds the prior draft to
  the generator framed as external work to critique — *never* "you wrote this."
- Build content-aware **Refresh** paths (prior draft + upstream delta) where edit
  preservation matters.
- Build the **version history + rollback** model (separate from apply-time
  snapshots) with retention.
- **Refine → Polish** rename in Letters.

Today's staleness banners (cover letter, prep) are Refresh-*intent* but
Regenerate-*behavior* (they call from-scratch regen). Until Tier 2, they should
read honestly as their behavior; they are the prime Tier-2 candidates for a real
Sharpen/Refresh path.

## Open questions

1. **Version-history scope** — which artifacts get a revision stack? (cover
   letters, prep decks for sure; theses, resumes, identity sections?)
2. **Retention** — N revisions, a time window, or both? Pruning is net-new and
   touches storage growth (persistence-tier work).
3. **Which surfaces get Refresh at all** vs. Sharpen-only.
4. **Sharpen icon** — reuse `Sparkles` or commission a dedicated mark so Sharpen
   reads distinct from first-run Generate.
