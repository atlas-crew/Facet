# Thread 1 — Correction-Driven Inference Staleness

**Status:** Design (2026-06-10). Thread 1 of the roadmap in
[`identity-derivation-graph-reframe-and-roadmap.md`](./identity-derivation-graph-reframe-and-roadmap.md).
Design only — no implementation yet; this reshapes the identity write path and is argued on
paper first.

**One line:** When a user corrects part of the identity model on the map, the inference
sections that consumed the corrected region should be marked potentially stale — using the
dependency graph that already exists — and that stale state should survive reload.

---

## Problem (verified in code)

The intra-identity staleness system (`identityInferenceDependencies.ts` + the "Potentially
stale" panel in `IdentityMapPage.tsx`) has two gaps:

1. **Regeneration-triggered, not correction-triggered.** Every `markStaleInferenceSections`
   call lives inside the regenerate/cascade flow (`runQueuedInferenceSections`,
   `runDownstreamRegenerationPlan`, the cascade-settle effect). A manual correction through an
   inspector (`updateCurrent*` on `identityStore`) marks nothing stale. So the product's stated
   principle — *correct one thing, see what it invalidates downstream* — does not fire on the
   most common action: a correction.

2. **Ephemeral.** `staleInferenceSections` is `useState` in `IdentityMapPage` (~line 489). It is
   lost on reload or navigation away from the map. Staleness about durable canonical data should
   be as durable as the data.

## Goal

A correction to region *R* marks the inference sections downstream of *R* as potentially stale,
persisted on the workspace, surfaced in the existing stale panel (and available to future
per-band affordances).

## Non-goals (explicitly deferred)

- **DAG precision** — keep the existing conservative linear chain. Over-warning is acceptable
  for Thread 1; precision is Thread 3.
- **Leveling / re-tell** — Thread 2. This thread only carries the cascade that leveling will
  later ride.
- **Auto-regeneration** — Thread 1 *marks* stale and offers refresh (existing "Regenerate all
  stale"). It never silently regenerates.
- **Graph 1 (identity→artifact) staleness** — out of scope here, but share vocabulary (see
  Reconciliation).

---

## Current state inventory

| Concern | Where | Note |
|---|---|---|
| Dependency chain | `identityInferenceDependencies.ts` | `bullets→skills→thesis→profiles→chapters→selfKnowledge→positioning→search`; `getDownstreamIdentityInferenceSections(section)` returns transitive downstream (exclusive of self). |
| Stale set (state) | `IdentityMapPage.tsx` `useState` | ephemeral; `markStale` / `clearStale` helpers local to the page. |
| Section dispatch | `runInferenceSectionRequest` (`IdentityMapPage.tsx:912`) | clears the section's own stale flag on run (`:915`), then regenerates. |
| Edit surface | `identityStore.ts` ~20 `updateCurrent*` actions + `addSkillToCurrentIdentity` / `removeSkillFromCurrentIdentity` / `applyAnswerPatch` | the correction choke points. |
| Inspector → setter | e.g. `ThesisInspector`→`updateCurrentIdentityCore`, `ProfileInspector`→`updateCurrentProfiles`, `SkillGroupInspector`→`updateCurrentSkillGroups`, `CompetitiveMoatInspector`→`updateCurrentCompetitiveMoat`, `ArcStopInspector`→`updateCurrentSelfModelArc`, `PhilosophyInspector`→`updateCurrentPhilosophy`, `SearchVectorInspector`→`updateCurrentSearchVectors` | verified. |

---

## Design

### 1. Move the stale set into the store (persisted)

Add to `identityStore`:

```ts
// Sections whose inputs were corrected since they were last generated.
staleInferenceSections: IdentityInferenceSection[]   // additive, optional-defaulted []
```

- **Persistence — decided (2026-06-10):** persist **and travel with the workspace** — the stale
  set lives on the identity artifact and is included in the workspace snapshot, so it survives
  reload, export/import, and hosted sync. It is durable derivation state about the canonical
  model, not a device-local hint. Additive optional field defaulted to `[]` → no migration
  required (additive optional fields skip migration). Run through the `facet-persistence-changes`
  checklist at implementation time to confirm snapshot inclusion (`FACET_WORKSPACE_SNAPSHOT`
  identity artifact), not just the local Zustand-persist slice.
- The map reads `staleInferenceSections` from the store instead of `useState`. Its existing
  `markStaleInferenceSections` / `clearStaleInferenceSections` helpers become store actions
  (`markInferenceSectionsStale`, `clearInferenceSectionsStale`). The cascade plumbing
  (`pendingInferenceCascade`, `runQueuedInferenceSections`, settle effect) keeps its current
  shape but reads/writes store staleness. **This is the one non-trivial refactor in Thread 1**
  and should be its own commit, behavior-preserving, before the trigger is added.

### 2. The trigger — producer/owner map

Each correctable region maps to the inference section that **produces** it. A correction to that
region marks `getDownstreamIdentityInferenceSections(section)` stale — downstream only,
**never the section itself** (the user just authored it; see §4).

**Producer regions** (a section regenerates them):

| Region / setter | Owning section |
|---|---|
| roles, role bullets (`updateCurrentRoles`, scanned-bullet updates), projects (`updateCurrentProjects`) | `bullets` (evidence) |
| `updateCurrentSkillGroups`, `updateCurrentExpertise`, `add/removeSkillToCurrentIdentity` | `skills` |
| `updateCurrentIdentityCore` **thesis fields only** (`thesis`, `elaboration`, `origin`, `title`) | `thesis` |
| `updateCurrentProfiles` | `profiles` |
| `updateCurrentSelfModelArc` | `chapters` |
| `updateCurrentPhilosophy`, `updateCurrentInterviewStyle` | `selfKnowledge` |
| `updateCurrentCompetitiveMoat`, `updateCurrentUnfairAdvantages` | `positioning` |
| `updateCurrentSearchVectors` | `search` |

**Input-only regions** (consumed by a section but produced by none):

| Region / setter | Effect |
|---|---|
| contact basics in `updateCurrentIdentityCore` (`name`, `email`, `phone`, `location`, `links`) | **no-op** — feeds no inference |
| preferences (`updateCurrentMatching`, `updateCurrentInterviewProcess`, `updateCurrentCompensation`, `updateCurrentWorkModel`, `updateCurrentConstraints`) | mark `search` stale (preferences feed search lanes/filters) |
| awareness answers (`applyAnswerPatch`, `updateCurrentAwarenessQuestions`, `updateCurrentAccuracyRules`) | conservative: mark from the most-upstream section touched (see §5) |

### 3. Mechanism — explicit intent, not blind diffing

The hard constraint, verified: the **same** setter serves both a human correction and an
inference writeback. `updateCurrentIdentityCore` is called by `ThesisInspector` (correction →
should cascade) *and* by thesis regeneration writeback (inference → should clear, not cascade).
A blind store subscription that diffs `currentIdentity` cannot tell them apart and would mark
downstream stale on every regeneration — the opposite of correct.

Therefore: **tag the intent at the call site.**

- **Recommended (Option B, action-tagged):** a store action
  `recordIdentityCorrection(section: IdentityInferenceSection)` that the inspector edit path
  calls after committing the edit. It runs `markInferenceSectionsStale(getDownstream(section))`
  and `clearInferenceSectionsStale([section])` (re-authoring clears self). Inference writebacks
  do **not** call it (they already clear via the dispatch path at `:915`). Small, explicit,
  inference-safe. The owning section is known at the inspector (each inspector edits exactly one
  region), so no diffing is needed for the common cases.
- **`updateCurrentIdentityCore` field-split:** because this setter is heterogeneous, the
  correction path inspects which keys changed: thesis fields → `recordIdentityCorrection('thesis')`;
  contact fields → no-op. This is a small field check inside one call site
  (`ThesisInspector` already knows it edits thesis; `ContactBasicsInspector` knows it edits
  contact), so in practice each inspector calls the right thing and no runtime field-diff is
  even required.

**Rejected — Option A (subscription/diff):** centralized but cannot distinguish correction from
writeback without a flag, which collapses it back into Option B. **Deferred — Option C
(fingerprint-derived):** record each section's input fingerprint at generation; staleness =
recorded ≠ current. This is the robust end state (survives reload, auto-clears on revert,
shares the `identityFingerprint` mechanism of `artifactMeta.ts`/TASK-168) — but it needs the
per-section input set, which is exactly Thread 3's `inputs(section)` map. Adopt C **after**
Thread 3; Option B is the Thread-1 increment and is forward-compatible (same store shape).

### 4. Self-edit semantics

Correcting a section's own output (e.g. editing the thesis text) must **not** mark the thesis
stale — the user just wrote it. `getDownstreamIdentityInferenceSections('thesis')` already
excludes `thesis`, so marking downstream + clearing self is correct: profiles…search light up,
thesis goes clean.

### 5. Answer patches (the one fuzzy edge)

`applyAnswerPatch` can write arbitrary identity fields, so its owning section is not fixed. For
Thread 1, take the conservative route: determine the set of regions the patch touched, map each
to its owning section, and mark the union of their downstreams. If that proves too coarse in
practice, it is a natural early beneficiary of Thread 3's field-level edges. Flag, don't
over-engineer.

---

## UX

No new surface required for the minimum. The existing "Potentially stale → Regenerate all stale"
panel now lights up from corrections, not only regenerations. Two cheap, optional improvements
(keep or defer):

- A per-band "may be stale" dot on bands whose section is in `staleInferenceSections`, so the
  signal is visible without scrolling to the panel. (Adjacent to Thread 3; keep minimal.)
- Carry the shepherding doc's Principle #3 framing in the panel copy — *what your correction
  may have invalidated* — rather than a bare "stale" label.

---

## Open decisions (need a call before build)

1. **Persisted vs. session staleness.** ✅ **Decided (2026-06-10):** persist + travel with the
   workspace snapshot (export/import + hosted sync), as durable derivation state on the identity
   artifact.
2. **Preferences → search.** Confirm preference edits should mark `search` stale (they feed
   lanes/filters per the shepherding graph). Low cost, high correctness; recommend yes.
3. **Answer-patch granularity (§5).** Accept conservative union for Thread 1, or hold answer
   patches out of the cascade until Thread 3? Recommend conservative-union now.
4. **Refactor scope.** Confirm the store-migration of the stale set (§1) lands as its own
   behavior-preserving commit before the trigger commit.

## Test plan

- **Unit (store):** `recordIdentityCorrection(section)` marks exactly `getDownstream(section)`
  and clears `section`; inference writeback path leaves the stale set untouched except its own
  clear. Producer-map table is a parameterized fixture.
- **Unit (map plumbing):** stale set sourced from store; "Regenerate all stale" drains it;
  regenerating a section clears its flag and re-queues its downstream as today.
- **Behavior:** edit a bullet → `skills…search` stale; edit thesis text → `profiles…search`
  stale, `thesis` clean; edit contact email → nothing stale; reload → stale set persists.
- **Regression:** the existing regenerate cascade and downstream-prompt modal behave exactly as
  before (the §1 refactor is behavior-preserving).

## Reconciliation with Graph 1

Use the same `IdentityInferenceSection` vocabulary and, when Thread 3 introduces
`inputs(section)`, express it in the same field-path language as `artifactMeta.identityFields`
so Option C's intra-identity fingerprints and the artifact-level fingerprints (TASK-168) are one
mechanism at two altitudes. Do not invent a second field-path scheme.

## Implementation gates

- `facet-persistence-changes` — for the new persisted store field.
- `facet-architecture-guard` — evidence-vs-narrative (corrections to evidence re-derive
  narrative, never the reverse) and identity-canonical-data (staleness is about
  `currentIdentity`).
