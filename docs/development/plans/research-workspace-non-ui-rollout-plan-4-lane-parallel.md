# Research Workspace — Non-UI Rollout Plan

> **Status: Complete (2026-05-08).** All four lanes closed. See `## Revision history` v3 below for closure details. Retained as a historical artifact; do not re-open without explicit milestone owner approval.

Companion to `doc-24` (design) and `doc-39` (Search Thesis Signal Canonicalization Design — TASK-204 decision artifact). Doc-24 captures *what* changes; doc-39 captures *the canonical-shape decision* for thesis signals; this doc captures *in what order* the rollout lands.

Scope is the open Research/Search backlog excluding visual/layout UI work. Visual UI redesign of the Research workspace is **not in scope here** and is currently neither tasked nor documented (separate from `TASK-64` which is code decomposition).

---

## Lanes

Four concurrent lanes, plus three "in-flight don't-touch" tasks. Inside each lane, ordering is dependency-driven; lanes themselves run in parallel except at named coordination points.

### Lane A — Output Quality

The chain that turns search results from "informational output" into "actionable output." Reference reports (founder's prior job-search PDFs, see `doc-24` Reference Material) include citations, paste-ready resume bullets, and surfaced assumptions — current output ships none of these.

```
TASK-184  Citation type + inline/footnote rendering    [high]   ⏳ in flight
   │
   ├──▶  TASK-183  Resume variant + bullet edits + keywords per result   [high]
   │
   ├──▶  TASK-185  Explicit-assumptions transparency on search output    [med]
   │
   └──▶  TASK-2.1  Surface result-level citation stripping violations    [—]
                   (depends on TASK-184; QA/telemetry follow-up)
```

`TASK-183` and `TASK-185` are independent of each other after `TASK-184` lands; they parallelize. `TASK-2.1` is a small post-184 follow-up to surface citation contract violations to telemetry.

### Lane B — Schema Convergence

The lanes-first migration. `SearchProfile` currently carries `vectors`, `SearchRequest` carries `focusVectors`, and `SearchThesis` has overlapping `lookFor` / `avoid` / `searchOverrides.filters.*` / `interviewPrefs.strongFit` storage. Each task in this lane removes a duplication the next depends on.

**Canonical-shape decision:** see `doc-39`. Summary: `SearchThesis.lookFor` and `SearchThesis.avoid` are canonical; `searchOverrides.filters.*` is deprecated and lifted into the canonical fields; interview-stage prefs are renamed (`strongFit`→`prepAdvantages`, `redFlags`→`processRisks`) to make stage explicit.

```
TASK-204    Consolidate avoid/prioritize/strongFit/lookFor on SearchThesis    [med]  ⏳ in flight
   │        (decision artifact; doc-39 captures the consolidation contract)
   ▼
TASK-204.1  Migrate SearchThesis signals off searchOverrides.filters          [med]
   ▼        (must land before TASK-196.3 — see Coordination #1)
TASK-204.2  Remove duplicate filter arrays from thesis generation contract    [med]
   ▼        (generator prompt + normalization cleanup)
TASK-204.3  Clean up Research preferences after canonical thesis signals      [med]
   ▼        (UI/wiring: route canonical signal edits to thesis strategy surface)
TASK-204.4  Reconcile TASK-196 filter toggles with canonical thesis signals   [med]
   ▼        (revisit 196.3/196.5 scope against canonical model)
TASK-197    Phase B: thesis lanes are the primary search-focus path           [med]
   ▼
TASK-198    Phase C: drop profile.vectors from SearchProfile                  [med]
   ▼
TASK-199    Phase D: remove focusVectors from SearchRequest                   [low]
```

Strictly sequential. Lane B is the critical path of the entire rollout.

### Lane C — Parameters + Filters

Sub-tasks of `TASK-196` (parent) plus the related filter-scoring fix. Two phases due to the Lane B cross-dependency: independent additions can run in parallel from day one; id/toggle work waits for Lane B's TASK-204.1 to land.

```
TASK-196.1  Bank enums + identity preference fields            [med]  ⏳ in flight
TASK-196.2  Restructure SearchProfileConstraints.compensation                  ┐  parallel,
            as SalaryBand min/max                              [med]           │  no Lane B
TASK-196.5  Replace filter text-area inputs with                                │  blocker
            per-item toggle list in SearchInstancePreferences  [med]           ┘
TASK-165    Conditional filter match scoring (uses condition)  [med]  ──── parallel anytime
   ▼
   ▼  ─────  AFTER Lane B's TASK-204.1 lands  ─────
   ▼
TASK-196.3  Stable filter id + per-search disabledFilterIds   [med]  ┐  scope may shrink
TASK-196.4  Hard-constraints controls                          [med]  │  per TASK-204.4
   ▼                                                                  ┘
TASK-196    Close parent when all sub-tasks land                       [med]
```

Lane B's TASK-204.4 may revise the scope of TASK-196.3 / TASK-196.5 (filter toggles target canonical thesis signals, or close the filter-toggle portion if no longer needed). Reconcile when 204.4 lands.

### Lane D — Ops, Types, Tests

Independent tasks with no interlocking dependencies (one exception: `TASK-62 → TASK-64`). Use as filler around Lanes A/B/C.

```
TASK-187   Discriminated unions for SearchFeedbackEvent / SearchRun       [med]
TASK-186   Add updatedAt timestamp to SearchFeedbackEvent for merge       [med]
           tie-breaking (data-integrity, follow-up from TASK-163 review)
TASK-188   Sweep orphan references on cascade-delete and import merge    [med]
           (relatedRunIds, triggeredByFeedbackIds, selectedRunIdByRequestId,
            workspace import merge — single pruneOrphans helper)
TASK-162   SSE subscription endpoint for research job streaming           [med]
TASK-166   Opus unavailability fallback for Phase 1                       [med]
TASK-175   Multi-tab concurrency / identity-version conflicts             [low]
TASK-172   Unify feedback events across search/prep/letter (cross-domain) [med]
TASK-103   Identity-first research persistence regression tests           [med]
TASK-105   Identity-first strategy + store regression coverage            [med]
TASK-206   Verify searchProfileInference resume-mode is dead and retire   [low]
TASK-62    Harden ResearchPage form/state coverage                        [med]
TASK-63    researchUtils edge-case coverage                               [med]  ⏳ in flight
   ▼
TASK-64    Decompose ResearchPage into tab-focused subcomponents          [low]
           (after TASK-62 — tests first to lock behavior)
```

### Already in flight (don't touch)

- **TASK-168** [high, In Progress] — Compute and display downstream impact of identity corrections
- **TASK-158** [med, In Progress] — Add artifact staleness detection and refresh triggers
- **TASK-184 + TASK-204** — Currently being implemented by another agent (per session note 2026-05-06)
- **TASK-196.1** — In Progress (Lane C)
- **TASK-63** — In Progress (Lane D)

These continue with their current owners. Coordinate at completion if their landing affects ordering elsewhere.

---

## Out of scope (research-adjacent but not Lane work)

Tasks that look research-related on first glance but live in different territories:

- **TASK-194** (Resolve thesis strength formula) — about identity Map's `IdentityFillStrength`/`thesisFillStrength`, not `SearchThesis`. Lives under Identity Map convergence (Cluster 1 in the broader audit), not here.

---

## Starting position

### 4-dev parallel start (with TASK-184/204 already in flight, 2 seats remain)

| Seat | Task | Lane | Why first |
|---|---|---|---|
| ~~1~~ | ~~TASK-184~~ | A | In flight via another agent |
| ~~2~~ | ~~TASK-204~~ | B | In flight via another agent |
| 3 | **TASK-196.2** + **TASK-196.5** | C | Schema + UI work that doesn't block on Lane B; can run in parallel with 196.1 (also in flight) |
| 4 | **TASK-187** OR **TASK-186** OR **TASK-188** | D | Independent type/data-integrity work; pick by dev's stack |

### 1–2 dev start (after Lane A/B agent returns)

Run **Lane A** (output quality, the leverage) and **Lane B** (schema convergence, the unblocker) in parallel through completion. Pull from Lane D between Lane A/B blockers.

---

## Cross-lane coordination

Five points where two lanes touch the same files. Resolution is named so it isn't relitigated.

1. **Lane B's TASK-204.1 ↔ Lane C's TASK-196.3** — both touch search filter storage.
   **Resolution:** **Lane B's TASK-204.1 lands FIRST.** Per doc-39: TASK-196.3 currently plans to add stable ids and `disabledFilterIds[]` to `SearchProfileFilterEntry` / `SearchInstanceFilterOverrides`; if Lane B deletes `searchOverrides.filters.prioritize/avoid` first, that id work targets canonical thesis signals (or shrinks/disappears). Reverse order would force build-then-delete churn.
   *(This is the inverse of what doc-38 originally said — corrected after reading doc-39 and TASK-204.1.)*

2. **Lane B's TASK-204.4 ↔ Lane C's TASK-196.3 / TASK-196.5** — Lane B may revise Lane C scope.
   **Resolution:** when TASK-204.4 lands, reconcile TASK-196.3 and TASK-196.5 to point at canonical thesis signals, or close the filter-toggle portion if per-search disabling is no longer needed. TASK-204.4 owns the reconciliation.

3. **Lane A's TASK-184 ↔ Lane B's TASK-204** — both touch `SearchThesis`-adjacent types.
   **Resolution:** parallel-safe — `Citation[]` is a new array, not a rename of existing fields. Heads-up only.

4. **Lane D's TASK-187 ↔ Lane A's TASK-185** — both touch `SearchRun`.
   **Resolution:** parallel-safe — 185 adds a field (`assumptions`), 187 reshapes status fields. Different surfaces.

5. **Lane D's TASK-64 (decompose) ↔ anything else touching ResearchPage** — exclusive lock on the page file.
   **Resolution:** run **TASK-62** first to lock behavior with tests. Then **TASK-64** with the safety net. Don't concurrent with any UI-side work.

---

## Critical path

Lane B is the longest unavoidable serial chain. With TASK-204's sub-tasks expanded, the chain is now:

```
TASK-204 → 204.1 → 204.2 → 204.3 → 204.4 → 197 → 198 → 199
```

Eight nodes, all serial. Everything else can pipeline around it. Treating Lane B as "we'll do that later" leaves the codebase carrying parallel storage (`lanes` + `vectors` + `focusVectors` + `lookFor` + `searchOverrides.filters.*` + `interviewPrefs.strongFit`) — every prompt iteration, every score tweak, every test fixture has to remember which one is canonical. Controlled demolition is cheaper than living with the redundancy.

```
Week 1:  Lane B (TASK-204 → 204.1)         │  Lanes A/C/D fan out
Week 2:  Lane B (TASK-204.2)               │  Lane A1 (TASK-184) lands → A2/A3/2.1 split
Week 3:  Lane B (TASK-204.3)               │  Lane C 196.1/196.2/196.5 close
Week 4:  Lane B (TASK-204.4)               │  Lane C 196.3/196.4 unblocked → land
Week 5:  Lane B (TASK-197)                 │  Lane C 196 closes
Week 6:  Lane B (TASK-198)                 │  Lane D bag draining
Week 7:  Lane B (TASK-199, closes)         │  Cleanup: TASK-64 (after TASK-62)
```

**Realistic total:** 7 weeks at solo pace (revised up from 5 — sub-task expansion of TASK-204 is the cause), 3–4 weeks at 4-dev parallel.

---

## How to use this doc

- New work begins **only** if it fits an existing lane or is filed as a new task and slotted in. No off-roadmap research/search work without explicit milestone owner approval.
- When a task lands, mark its node in the lane diagrams above with ✓ (or update via task status — the doc reads the diagrams as a snapshot, not a live tracker; the live tracker is `task list --search "lane-b"` or filter by labels).
- If a coordination point comes up that isn't named here, add it before resolving — that's the doc's only debt-prevention job.

## Open questions

- **Should these tasks be grouped under a milestone?** Audience tagging got `m-28`. The Research non-UI rollout could justify its own milestone. With 7 weeks of work and many parallel lanes, a milestone is now more clearly worth the bookkeeping than when this doc was originally drafted.
- **What about a Research workspace UI redesign?** Not in scope here. If a brief lands, this plan needs reevaluation for ordering — at minimum, `TASK-64` (decompose) becomes a hard prerequisite for any visual rework, not a low-priority cleanup.
- **TASK-2.1 priority:** filed without a priority label. It's a small QA/telemetry follow-up to TASK-184; treat as Low unless contract violations become a recurring concern.

---

## Pointers

- Design context: `doc-24` (Search Workspace Redesign — Search Thesis, Semantic Depth, Feedback Loop)
- Canonical-shape decision: `doc-39` (Search Thesis Signal Canonicalization Design)
- Architectural framing: `doc-37` (Research is Discovery, Not a Per-Listing Artifact)
- Search parameters surface design: `doc-34` (Search Parameters Surface — Hard Constraints + Per-Search Filter Toggles)
- Reference reports informing output contract: stored outside the repo (founder's prior job-search PDFs); see `doc-24` Reference Material
- Code surfaces: `src/routes/research/`, `src/utils/searchExecutor.ts`, `src/utils/identitySearchProfile.ts`, `src/types/search.ts`, `src/identity/schema.ts`

---

## Revision history

- **2026-05-06 v1**: initial 4-lane plan (TASK-184/204 starting positions, 5-week estimate).
- **2026-05-06 v2**: revisions after audit:
  - Closed TASK-97 (stale build-fix; module exists, build green).
  - Lane A: added TASK-2.1 as TASK-184 follow-up.
  - Lane B: expanded TASK-204 into sub-tasks 204.1/.2/.3/.4 (per doc-39 design decision); critical path grows from 4 → 8 nodes.
  - Lane C: added TASK-196.2 and TASK-196.5; reordered so 196.3/.4 wait for Lane B's 204.1.
  - Lane D: added TASK-186, TASK-188, TASK-206.
  - **Coordination point #1 reversed:** Lane B's TASK-204.1 lands BEFORE Lane C's TASK-196.3, not after (per doc-39 sequencing analysis).
  - Marked TASK-184/204 as in flight via another agent.
  - Marked TASK-196.1, TASK-63 as In Progress.
  - Out-of-scoped TASK-194 (identity Map territory, not SearchThesis).
  - Pointers expanded with doc-39 and doc-34.
  - Realistic estimate: 5 → 7 weeks solo / 2-3 → 3-4 weeks parallel.
- **2026-05-08 v3**: rollout complete. All 28 named tasks across all four lanes are Done. TASK-196 parent closed as bookkeeping after all five subtasks landed. Two Lane C subtasks (TASK-196.3 per-search signal disablement, TASK-196.5 per-item toggle UI) closed via explicit de-scope after TASK-204.1 made the underlying storage shape obsolete — building toggles against canonical thesis signals would have duplicated the Search Thesis editor surface that TASK-204.3 already routes to. TASK-206 audit reclassified the resume-mode `inferSearchProfile` path as live-not-dead, deferring retirement to TASK-238/TASK-239. Actual elapsed time from v1 → completion: ~48 hours of intense parallel work (vs. the 7-week solo estimate), driven by multiple concurrent agents. Doc retained as historical artifact.
