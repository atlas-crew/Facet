---
id: doc-41
title: Prep V2 — PrepDeck Foundation + Content Extensions Rollout Plan
type: other
created_date: '2026-05-07 19:10'
---
# Prep V2 — PrepDeck Foundation + Content Extensions Rollout Plan

Organizes the open Prep workspace backlog under one rollout. Foundation work (output contract validation + structured types) lands first so subsequent content extensions have validation; content extensions (alternative narratives, technical drills, beat sheets, multi-story, pushback scripts) layer on top.

No equivalent design doc exists yet for this rollout. Each task carries its own description; this doc just sequences them.

---

## Lanes

Four concurrent lanes. Lane A is foundation and gates Lane C; Lanes B and D are independent.

### Lane A — Foundation contract (critical path, sequential)

Locks down the PrepDeck output contract and adds structured types before content surface area expands. Without this, content extensions ship without validation and produce a moving target for future regressions.

```
TASK-170  Add prep output contract validation for prepGenerator   [done]
   │      (validation gates the deck shape; lands first so 171 has something to validate)
   ▼
TASK-171  Add structured PrepCompanyIntel and PrepInterviewer to PrepDeck  [done]
          (replaces flat string fields with structured intel/interviewer entities;
           Lane C content extensions then read structured types instead of strings)
```

### Lane B — Skill mapping (independent, single design decision)

```
TASK-173  Document and apply stack alignment ↔ semantic skill depth mapping  [done]
          (cross-cuts identity skill depth → prep card content; produces a
           reference doc + applies the mapping in prepGenerator. No code
           dependency on Lane A but pairs naturally with TASK-171's skill-aware
           prep content)
```

### Lane C — Card content extensions (after Lane A foundation)

PrepCard surface expansions. Each is a discrete content addition; they parallelize once Lane A's contract validation is in place. Lane A blocks Lane C because each new card field needs the contract to assert against.

```
TASK-136  Add alternative narrative support to prep cards         [med]
TASK-139  Add technical drills with answer template               [med]
TASK-137  Add one-liner quotable takeaways                        [done]
TASK-146  Add multi-role narrative arc for core pitch opener      [done]
TASK-177  Add beat sheet and glance points to PrepCard            [done]
TASK-179  Add multi-story support to PrepCard via storyVariants   [low]
TASK-180  Add "if they push" pushback script to PrepCard          [low]
```

All seven are parallel-safe with each other once unblocked. Order them by leverage: 136 + 139 are the deepest content shifts (alternative narratives, technical drills with templates), 137/146/177/179/180 are smaller surface additions.

### Lane D — Quality / cross-cutting

Independent of Lanes A-C. Pick up as filler.

```
TASK-140  Evaluate Opus model for prep generation quality                  [med]
          (quality eval — produces a recommendation, may or may not result
           in code change. Doesn't block other lanes)

TASK-229  [m-28] Phase 7: refactor prep generator to apply candidate       [med]
          audience projection
          (audience-tagging cross-reference; coordinates with Lane A's
           TASK-171 since both touch PrepDeck shape — see Coordination #1)
```

---

## Cross-lane coordination

Two coordination points:

1. **Lane A's TASK-171 ↔ Lane D's TASK-229 (m-28).**
   Both touch `PrepDeck` shape. TASK-171 adds structured `PrepCompanyIntel` / `PrepInterviewer` types; TASK-229 wires `projectForAudience(jdAnalysis, 'candidate')` into the prep generator.
   **Resolution:** land TASK-171 first. The audience projection in TASK-229 reads from JDAnalysis, not from PrepDeck directly — so the projection wires *into* the generator, not into the deck shape. But test fixtures will overlap; coordinate fixture migration to avoid two passes.

2. **Lane A's TASK-170 ↔ all of Lane C.**
   TASK-170's output contract validation must include the new card fields. As Lane C extensions land, each one extends the contract.
   **Resolution:** TASK-170 ships with the *current* card shape's contract. Each Lane C task extends the contract assertions in the same commit — that's how the validation stays current and the card additions can't silently regress.

---

## Already in flight

None. Lane A and Lane B are done; Lane C remains open for content extensions.

---

## Out of scope

- **PrepLiveMode + PrepLiveCheatsheet** — covered by `m-17` and `m-18` (Live Cheatsheet Content MVP / V2.1) milestones, not this rollout.
- **TASK-44** (PIPELINE_PREP_SPEC docs reconciliation) — documentation cleanup that touches Prep, but doesn't extend functionality. Defer to maintenance pass.
- **Prep round progression** (m-26) — meta-workflow concern, separate milestone.

---

## Starting position

### 3-dev parallel start

| Seat | Task | Lane | Why first |
|---|---|---|---|
| 1 | **TASK-170** | A | Foundation; lands first to gate Lane C; small scope |
| 2 | **TASK-173** | B | Independent design+apply task; produces reference doc useful to all later prep work |
| 3 | **TASK-140** | D | Quality eval; produces recommendation; non-blocking |

After Lane A's TASK-170 lands, seat 1 picks up TASK-171, seat 2 finishes TASK-173, seat 3 starts the highest-leverage Lane C content extension (TASK-136 or 139).

### 1-dev start

Strict sequence: TASK-170 → 171 → 173 → highest-leverage Lane C tasks (136, 139) → polish (137, 146, 177, 179, 180). Pull TASK-140 between content extensions when an Opus eval is timely. TASK-229 ships when m-28 reaches Phase 7.

---

## Critical path

```
TASK-170 → 171 → (Lane C content extensions, parallel)
```

Two foundation tasks gate the seven-task content fan-out. Realistic solo pace: ~6-8 weeks (foundation 2 weeks, full Lane C ~5 weeks staggered). At 3-dev parallel: ~3-4 weeks.

---

## How to use this doc

- New prep-card surface additions get filed as new tasks slotted into Lane C.
- TASK-170's contract is extended as each new card field lands. The validator file is the source of truth for "what shape can a PrepDeck have."
- If a Lane C extension changes the structured types from TASK-171 (e.g., adds a new field to `PrepInterviewer`), update TASK-171's done state vs. file a follow-up — depends on whether the schema change is forward-compatible.

## Open questions

- **Should this rollout get its own milestone?** With 11 open tasks across 4 lanes, a "Prep V2" milestone is more legible than relying on this doc alone — multiple-developer parallel work is easier to coordinate against an explicit milestone label. Defer the decision; revisit if multiple agents pick up Lane C concurrently.
- **TASK-140's recommendation is not a commitment.** The Opus eval produces a recommendation; if it suggests switching default models, that's a separate task to schedule (likely a small proxy/feature-flag change). Don't pre-commit Lane D throughput on a positive Opus result.
- **Audience-tagging Phase 7 ordering** (TASK-229) — currently filed under m-28. If the audience-tagging team races ahead and lands TASK-229 before Lane A foundation, the JDAnalysis projection wires into a still-flat PrepDeck shape, which is fine but produces a temporary inconsistency. Coordinate timing with the m-28 owner.

---

## Pointers

- Audience-tagging cross-ref: `m-28` milestone (especially TASK-229 for Phase 7 prep audience projection)
- Live cheatsheet milestones (out of scope here): `m-17`, `m-18`
- Prep round progression (out of scope here): `m-26`
- Code surfaces: `src/utils/prepGenerator.ts`, `src/routes/prep/PrepPage.tsx`, `src/types/prep.ts`, `src/store/prepStore.ts`

---

## Revision history

- **2026-05-07 v1**: initial Prep V2 rollout plan. Foundation contract → content extensions, with audience-tagging Phase 7 task tracked as cross-reference.
