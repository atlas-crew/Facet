---
id: doc-40
title: Identity Map Convergence — Strategy D Rollout Plan
type: other
created_date: '2026-05-07 19:09'
---
# Identity Map Convergence — Strategy D Rollout Plan

Companion to `TASK-202`'s description (which contains the Strategy D decision and pattern guard). This doc captures the *rollout sequencing* for finishing the Map-only canonical-workspace transition and the surrounding scan/intake hardening work.

Scope is the open Identity workspace backlog. The candidate identity Map is the canonical edit surface — *not* the Research workspace's thesis Map (`src/routes/research/ThesisMapPanel.tsx`). TASK-205 and TASK-201 are research-thesis-map work and belong in `doc-38`, not here.

---

## Lanes

Three concurrent lanes plus one in-flight sequence. Inside each lane, ordering is dependency-driven; lanes themselves run in parallel.

### Lane A — Strategy D convergence (critical path, sequential)

Finishing the "Map-only canonical workspace" arc. TASK-202's description is the design artifact; this lane is the execution sequence. ScannedIdentityEditor's keep-worthy features get Map-side homes; scan-only features retire with the editor.

```
TASK-202     Strategy D parent (in progress, owns the convergence decision)
   │         (TASK-202.1 — sheet primitive — already closed)
   ▼
TASK-202.2   Decide which ScannedIdentityEditor features lift to Map  [in progress]
   │         (lift/scan-only/retire matrix; each lift is its own atomic commit)
   ▼
TASK-202.3   Retire or reduce ScannedIdentityEditor after the lift     [med]
   │
   ▼
DRAFT-2      Decide and execute the import flow's final form factor
             (route / overlay / sheet — promoted from Draft when 202.1
              made the sheet feel concrete)
   ▼
TASK-202     Closes when all sub-tasks land
```

### Lane B — Map UX fixes (parallel, anytime)

Discrete user-visible Map issues that don't depend on Lane A. Each is a self-contained fix.

```
TASK-218  Fix sel/focus stale-notice interaction on IdentityMapPage   [med]
          (small scoped UX fix — selection/focus-state interaction bug)

TASK-194  Resolve thesis strength formula                             [med]
          (theory-of-thesis decision: prose-only vs composite-artifact;
           replace text-length proxy with sentence/specificity heuristics;
           coordinates with Lane A on inspector-slot rendering)
```

### Lane C — Scan / intake hardening (parallel, anytime)

Identity scanner pipeline + identity store regression coverage. Independent of Lane A's editor-deletion arc.

```
TASK-87    Align scan store field typing and normalization conventions  [med]
TASK-89    Broaden identityStore scan persistence coverage              [med]
TASK-92    Expand medium-priority identity scanner browser fixtures     [med]
TASK-114.4 Expand skill enrichment wizard regression coverage           [med]
TASK-114.6 Add case-variant skill dedupe safeguards                     [med]
```

These can all run in parallel with each other and with Lanes A/B.

### Lane D — Test coverage (filler)

Sad-path / failure-path coverage on the surfaces Strategy D leaves canonical.

```
TASK-100   Harden IdentityPage failure-path and bulk-flow tests   [med]
TASK-200   Phase 2 sad-path test coverage for identity Map editing [low]
```

`TASK-200` ideally lands after Lane A so the tests target the post-Strategy-D surface, not a moving target. `TASK-100` is independent.

---

## Already in flight

- **TASK-202** [in progress] — Strategy D parent
- **TASK-202.2** [in progress] — ScannedIdentityEditor lift matrix

These continue with their owner. Coordinate when each lands.

---

## Out of scope

- **TASK-205** — Move Constraints/Preferences/Skills off Profile Editor. Despite the name, this is *Research workspace* work (thesis Map / `ThesisMapPanel.tsx`), not the candidate identity Map. Belongs in `doc-38`.
- **TASK-201** — Profile Editor Skills card layout. Same reason — research workspace UI.
- **TASK-115.3** — Strategy workbench regression coverage. Closed 2026-05-07 as zombie (workbench deleted in TASK-195).
- **TASK-195's deferred decisions** (accuracy rules CRUD, AI-generate UI, autofill empty-state hints) — re-open on user-signal triggers, not part of this rollout.
- **ProfileInspector "Generate variant"** — was deleted with the handoffs; needs Map-side home when AI-generation work resumes; track separately.

---

## Cross-lane coordination

Two coordination points:

1. **Lane B's TASK-194 ↔ Lane A's inspector-slot rendering.**
   TASK-194's "what is a thesis?" decision (prose-only vs composite-artifact) determines whether the inspector slot's `<Prompt>` block surfaces unset metadata fields. If composite-artifact wins, `BulletInspector` / equivalent slots need to reinstate the guidance. Resolve TASK-194's design decision *before* Lane A's TASK-202.2 finalizes the lift matrix for thesis-related fields, so the matrix can route to a known UI shape.

2. **Lane A's TASK-202.3 ↔ Lane C's TASK-87 / 89 / 92.**
   Scan-store typing and persistence coverage may exercise code paths that reach into `ScannedIdentityEditor`. Confirm the Lane C tests don't depend on the soon-to-be-deleted editor. If they do, refactor to test the lifted Map-side equivalent before TASK-202.3 deletes the editor file.

---

## Starting position

### 4-dev parallel start (TASK-202.2 already in flight)

| Seat | Task | Lane | Why first |
|---|---|---|---|
| ~~1~~ | ~~TASK-202.2~~ | A | In progress |
| 2 | **TASK-194** | B | Design decision unblocks inspector slot guidance choices; small scope |
| 3 | **TASK-218** | B | Small scoped UX fix; non-blocking |
| 4 | **TASK-87** OR **TASK-89** | C | Independent type/coverage work; pick by dev's stack |

### 1–2 dev start

Drive Lane A through completion (single-threaded critical path), pull from Lane C as filler when 202.2/202.3 are awaiting review. Park Lane B for after Lane A lands so all three are completed in sequence rather than abandoned partway.

---

## Critical path

Lane A's serial chain is the convergence-finishing path:

```
TASK-202.2 → 202.3 → DRAFT-2 → TASK-202 closes
```

Three execution nodes plus the parent close. Each gates the next. Realistic at solo pace: ~3 weeks. With Lane B/C/D filler running in parallel, all 11 tasks close in ~4-5 weeks.

---

## How to use this doc

- New work begins **only** if it fits an existing lane or is filed as a new task and slotted in.
- When a task lands, mark its node in the lane diagrams above with ✓.
- Coordination points get added before resolving — that's the doc's only debt-prevention job.

## Open questions

- **Should this rollout get its own milestone?** Audience tagging got `m-28`; Research (`doc-38`) didn't. With ~11 tasks across 4 lanes, a milestone is borderline worth the bookkeeping. Defer the decision; revisit if multiple agents end up working concurrently.
- **TASK-194 deserves its own design decision before implementation.** The two theories (prose-only vs composite-artifact) have different downstream UI consequences. Worth a 30-min decision spike before scheduling implementation.
- **DRAFT-2 (import flow form factor) is not yet a real task** — it's referenced in TASK-202 as a draft. Promote it to a real subtask after TASK-202.1 makes the sheet primitive feel concrete.

---

## Pointers

- Strategy D decision + pattern guard: `TASK-202` description
- Identity convergence Phase 1/2: `TASK-195` (Done) — IdentityStrategyWorkbench deletion + Map inspector migration
- Code surfaces: `src/routes/identity/IdentityMapPage.tsx`, `src/routes/identity/IdentityInspector.tsx`, `src/routes/identity/ScannedIdentityEditor.tsx`, `src/routes/identity/bands/`, `src/routes/identity/inspectorSlots/`, `src/store/identityStore.ts`, `src/utils/identityFillStrength.ts`

---

## Revision history

- **2026-05-07 v1**: initial Strategy D rollout plan. Closed TASK-115.3 (strategy workbench zombie). Out-of-scoped TASK-205 / TASK-201 (research workspace, not identity workspace).
