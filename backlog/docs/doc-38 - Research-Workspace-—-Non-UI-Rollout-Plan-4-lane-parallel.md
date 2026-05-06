---
id: doc-38
title: Research Workspace — Non-UI Rollout Plan (4-lane parallel)
type: other
created_date: '2026-05-06 21:15'
---
# Research Workspace — Non-UI Rollout Plan

Companion to `doc-24` (design) — that doc captures *what* changes; this one captures *in what order*. Scope is the open Research/Search backlog excluding visual/layout UI work.

Visual UI redesign of the Research workspace is **not in scope here** and is currently neither tasked nor documented (separate from `TASK-64` which is code decomposition). If a UI redesign brief lands, this plan should be reread for ordering implications (e.g., land `TASK-64` before any layout rework).

---

## Lanes

Four concurrent lanes, plus two "in-flight don't-touch" tasks. Inside each lane, ordering is dependency-driven; lanes themselves run in parallel except at named coordination points.

### Lane A — Output Quality

The chain that turns search results from "informational output" into "actionable output." Reference reports (founder's prior job-search PDFs, see `doc-24` Reference Material) include citations, paste-ready resume bullets, and surfaced assumptions — current output ships none of these.

```
TASK-184  Citation type + inline/footnote rendering    [high]
   │
   ├──▶  TASK-183  Resume variant + bullet edits + keywords per result   [high]
   │
   └──▶  TASK-185  Explicit-assumptions transparency on search output    [med]
```

`TASK-183` and `TASK-185` are independent of each other after `TASK-184` lands; they parallelize.

### Lane B — Schema Convergence

The lanes-first migration. `SearchProfile` currently carries `vectors`, `SearchRequest` carries `focusVectors`, and `SearchThesis` has overlapping `avoid` / `prioritize` / `strongFit` / `lookFor` fields. Each task in this lane removes a duplication the others depend on.

```
TASK-204  Consolidate avoid/prioritize/strongFit/lookFor on SearchThesis  [med]
   ▼
TASK-197  Phase B: thesis lanes are the primary search-focus path         [med]
   ▼
TASK-198  Phase C: drop profile.vectors from SearchProfile                [med]
   ▼
TASK-199  Phase D: remove focusVectors from SearchRequest                 [low]
```

Strictly sequential. Each landing makes the next safe.

### Lane C — Parameters + Filters

Sub-tasks of `TASK-196` (parent) plus the related filter-scoring fix. Fan out, then close the parent.

```
TASK-196.1  Bank enums + identity preference fields            [med]  ┐
TASK-196.3  Stable filter id + per-search disabledFilterIds   [med]  ├── parallel
TASK-196.4  Hard-constraints controls                          [med]  ┘
TASK-165    Conditional filter match scoring (uses condition)  [med]  ── parallel
   ▼
TASK-196    Close parent when 196.1 / 196.3 / 196.4 land       [med]
```

Four developers could swarm and close in a week. One developer can take any order.

### Lane D — Ops, Types, Tests

Independent tasks with no interlocking dependencies (one exception: `TASK-62 → TASK-64`). Use as filler around Lanes A/B/C.

```
TASK-187   Discriminated unions for SearchFeedbackEvent / SearchRun       [med]
TASK-162   SSE subscription endpoint for research job streaming           [med]
TASK-166   Opus unavailability fallback for Phase 1                       [med]
TASK-175   Multi-tab concurrency / identity-version conflicts             [low]
TASK-172   Unify feedback events across search/prep/letter (cross-domain) [med]
TASK-103   Identity-first research workspace persistence regression tests [med]
TASK-105   Identity-first strategy + store regression coverage            [med]
TASK-62    Harden ResearchPage form/state coverage                        [med]
TASK-63    researchUtils edge-case coverage                               [med]
   ▼
TASK-64    Decompose ResearchPage into tab-focused subcomponents          [low]
           (after TASK-62 — tests first to lock behavior)
```

### Already in flight (don't touch)

- **TASK-168** [high, In Progress] — Compute and display downstream impact of identity corrections
- **TASK-158** [med, In Progress] — Add artifact staleness detection and refresh triggers

These continue with their current owners. Coordinate at completion if their landing affects Lane A/E ordering.

---

## Starting position

### 4-dev parallel start

| Seat | Task | Lane | Why first |
|---|---|---|---|
| 1 | **TASK-184** | A | Highest leverage, types-only scope, fast to land, unblocks 183 + 185 |
| 2 | **TASK-204** | B | Cleans up thesis fields before lanes-as-primary; serial blocker for 197/198/199 |
| 3 | **TASK-196.1** + **TASK-196.4** | C | Schema additions; biggest parts of the C cluster |
| 4 | **TASK-187** OR **TASK-162** | D | Independent; pick by dev's stack (types vs proxy) |

### 1–2 dev start

Run **Lane A** (output quality, the leverage) and **Lane B** (schema convergence, the unblocker) in parallel. Pull from Lane D between Lane A/B blockers.

---

## Cross-lane coordination

Four points where two lanes touch the same files. Resolution is named so it isn't relitigated.

1. **Lane B's TASK-197 vs Lane C's TASK-196.1** — both touch `SearchProfile`.
   **Resolution:** land Lane C tasks first (they're additive new fields). Then Lane B's TASK-197 can move existing fields without conflict.

2. **Lane A's TASK-184 vs Lane B's TASK-204** — both touch `SearchThesis`-adjacent types.
   **Resolution:** parallel-safe — `Citation[]` is a new array, not a rename of existing fields. Heads-up only.

3. **Lane D's TASK-187 vs Lane A's TASK-185** — both touch `SearchRun`.
   **Resolution:** parallel-safe — 185 adds a field (`assumptions`), 187 reshapes status fields. Different surfaces.

4. **Lane D's TASK-64 (decompose) vs anything else touching ResearchPage** — exclusive lock on the page file.
   **Resolution:** run **TASK-62** first to lock behavior with tests. Then **TASK-64** with the safety net. Don't concurrent with any UI-side work.

---

## Critical path

Lane B is the longest unavoidable serial chain (TASK-204 → 197 → 198 → 199). Everything else can pipeline around it. If you want to compress total wall time, **dedicate a single dev to Lane B from day one** and let the other lanes complete around it. Treating Lane B as "we'll do that later" leaves the codebase carrying `lanes` + `vectors` + `focusVectors` simultaneously for months — every prompt iteration, every score tweak, every test fixture has to remember which one is canonical. Controlled demolition is cheaper than living with the redundancy.

```
Week 1:  Lane B starts (TASK-204)         │  Lanes A/C/D fan out
Week 2:  Lane B (TASK-197)                │  Lane A1 (TASK-184) lands → A2/A3 split
Week 3:  Lane B (TASK-198)                │  Lane C closes  │  Lane D bag draining
Week 4:  Lane B (TASK-199, closes)        │  A2/A3 land     │  D bag mostly drained
Week 5:  Lane B done                      │  Cleanup: TASK-64 (after TASK-62)
```

**Realistic total:** 5 weeks at solo pace, 2–3 weeks at 4-dev parallel.

---

## How to use this doc

- New work begins **only** if it fits an existing lane or is filed as a new task and slotted in. No off-roadmap research/search work without explicit milestone owner approval.
- When a task lands, mark its node in the lane diagrams above with ✓ (or update via task status — the doc reads the diagrams as a snapshot, not a live tracker; the live tracker is `task list --milestone <m>` or whichever milestone these get attached to).
- If a coordination point comes up that isn't named here, add it before resolving — that's the doc's only debt-prevention job.

## Open questions

- **Should these tasks be grouped under a milestone?** Audience tagging got `m-28`. The Research non-UI rollout could justify its own milestone (call it "Research Output Quality + Schema Convergence" or similar). Worth the bookkeeping if multiple devs are ever working concurrently across the lanes; less so for solo work where the milestone IS the doc.
- **What about a Research workspace UI redesign?** Not in scope here. If a brief lands, this plan needs reevaluation for ordering — at minimum, `TASK-64` (decompose) becomes a hard prerequisite for any visual rework, not a low-priority cleanup.

---

## Pointers

- Design context: `doc-24` (Search Workspace Redesign — Search Thesis, Semantic Depth, Feedback Loop)
- Architectural framing: `doc-37` (Research is Discovery, Not a Per-Listing Artifact)
- Reference reports informing output contract: stored outside the repo (founder's prior job-search PDFs); see `doc-24` Reference Material
- Code surfaces: `src/routes/research/`, `src/utils/searchExecutor.ts`, `src/utils/identitySearchProfile.ts`, `src/types/search.ts`, `src/identity/schema.ts`
