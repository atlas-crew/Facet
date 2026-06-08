# Identity Map Convergence — Strategy D Rollout Plan

Companion to `TASK-202`'s description (which contains the Strategy D decision and pattern guard). This doc captures the *rollout sequencing* for finishing the Map-only canonical-workspace transition and the surrounding scan/intake hardening work.

Scope is the open Identity workspace backlog. The candidate identity Map is the canonical edit surface — *not* the Research workspace's thesis Map (`src/routes/research/ThesisMapPanel.tsx`). TASK-205 and TASK-201 are research-thesis-map work and belong in `doc-38`, not here.

---

## Lanes

Three concurrent lanes plus one in-flight sequence. Inside each lane, ordering is dependency-driven; lanes themselves run in parallel.

### Lane A — Strategy D convergence (critical path, sequential)

Finishing the "Map-only canonical workspace" arc. TASK-202's description is the design artifact; this lane is the execution sequence. ScannedIdentityEditor's keep-worthy features get Map-side homes; scan-only features retire with the editor.

```
TASK-202     Strategy D parent [done]
   │         (TASK-202.1 — sheet primitive — already closed)
   ▼
TASK-202.2   Decide which ScannedIdentityEditor features lift to Map  [done]
   │         (lift/scan-only/retire matrix; each lift is its own atomic commit)
   ▼
TASK-202.3   Retire or reduce ScannedIdentityEditor after the lift     [done]
   │
   ▼
TASK-243     Decide and execute the import flow's final form factor    [done]
             (route-but-ephemeral; /identity/import returns to Map after Apply)
   ▼
TASK-202     Closed after all sub-tasks landed
```

### Lane B — Map UX fixes (parallel, anytime)

Discrete user-visible Map issues that don't depend on Lane A. Each is a self-contained fix.

```
TASK-218  Fix sel/focus stale-notice interaction on IdentityMapPage   [done]
          (small scoped UX fix — selection/focus-state interaction bug)

TASK-194  Resolve thesis strength formula                             [done]
          (theory-of-thesis decision: prose-only vs composite-artifact;
           replace text-length proxy with sentence/specificity heuristics;
           coordinates with Lane A on inspector-slot rendering)
```

### Lane C — Scan / intake hardening (parallel, anytime)

Identity scanner pipeline + identity store regression coverage. Independent of Lane A's editor-deletion arc.

```
TASK-87    Align scan store field typing and normalization conventions  [done]
TASK-89    Broaden identityStore scan persistence coverage              [done]
TASK-92    Expand medium-priority identity scanner browser fixtures     [done]
TASK-114.4 Expand skill enrichment wizard regression coverage           [done]
TASK-114.6 Add case-variant skill dedupe safeguards                     [done]
```

These can all run in parallel with each other and with Lanes A/B.

### Lane D — Test coverage (filler)

Sad-path / failure-path coverage on the surfaces Strategy D leaves canonical.

```
TASK-100   Harden IdentityPage failure-path and bulk-flow tests   [done]
TASK-200   Phase 2 sad-path test coverage for identity Map editing [done]
```

`TASK-200` ideally lands after Lane A so the tests target the post-Strategy-D surface, not a moving target. `TASK-100` is independent.

---

## Already in flight

- No doc-40 tasks are currently in flight.

TASK-114.6 landed in commit `498ac69` and is closed; its earlier write set is no longer active.

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

1. **Lane B's TASK-194 ↔ Lane A's inspector-slot rendering.** Resolved. TASK-194 closed before the final Lane A closeout and no longer blocks the lift matrix.

2. **Lane A's TASK-202.3 ↔ Lane C's TASK-87 / 89 / 92.** TASK-202.3 landed. Future Lane C tests should target `ScanReviewPane`, the identity store, or lifted Map-side equivalents; do not add new source references to `ScannedIdentityEditor`.

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

Lane A's serial chain was the convergence-finishing path and is now closed:

```
TASK-202.2 → 202.3 → TASK-243 → TASK-202
```

Doc-40 rollout is closed.

---

## How to use this doc

- New work begins **only** if it fits an existing lane or is filed as a new task and slotted in.
- When a task lands, mark its node in the lane diagrams above with ✓.
- Coordination points get added before resolving — that's the doc's only debt-prevention job.

## Open questions

- **Should this rollout get its own milestone?** Audience tagging got `m-28`; Research (`doc-38`) didn't. With ~11 tasks across 4 lanes, a milestone is borderline worth the bookkeeping. Defer the decision; revisit if multiple agents end up working concurrently.
- **TASK-194 design decision is closed.**
- **DRAFT-2 is closed as TASK-243.**

---

## Pointers

- Strategy D decision + pattern guard: `TASK-202` description
- Identity convergence Phase 1/2: `TASK-195` (Done) — IdentityStrategyWorkbench deletion + Map inspector migration
- Code surfaces: `src/routes/identity/IdentityMapPage.tsx`, `src/routes/identity/IdentityInspector.tsx`, `src/routes/identity/ScanReviewPane.tsx`, `src/routes/identity/bands/`, `src/routes/identity/inspectorSlots/`, `src/store/identityStore.ts`, `src/utils/identityFillStrength.ts`

---

## Revision history

- **2026-05-07 v1**: initial Strategy D rollout plan. Closed TASK-115.3 (strategy workbench zombie). Out-of-scoped TASK-205 / TASK-201 (research workspace, not identity workspace).
- **2026-05-08 v2**: Lane A closed through TASK-202.2, TASK-202.3, TASK-243, and parent TASK-202. Lane B closed. TASK-87, TASK-92, TASK-100, TASK-114.6, and TASK-200 closed. Doc-40 rollout closed.
