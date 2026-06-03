---
id: TASK-202
title: 'Complete Strategy D: Map-only canonical workspace'
status: Done
assignee:
  - '@nick'
created_date: '2026-04-30 18:39'
updated_date: '2026-05-08 21:05'
labels:
  - identity
  - map-convergence
  - strategy-d
dependencies: []
references:
  - src/routes/identity/IdentityMapPage.tsx
  - src/routes/identity/IdentityPage.tsx
  - src/routes/identity/IdentityInspector.tsx
  - src/routes/identity/ScanReviewPane.tsx
  - src/routes/identity/bands/RolesBand.tsx
  - src/routes/identity/inspectorSlots/BulletInspector.tsx
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context

TASK-195 (Done) closed the first two phases of identity-workspace convergence: deleted `IdentityStrategyWorkbench` (Phase 1) and migrated most canonical-edit fields to Map's inspector slots (Phase 2). Post-shipping review identified that the convergence was framed as "Map = canonical, Workbench = import-only" but executed as a hybrid:

1. Bullet content was invisible on Map — `RolesBand.tsx` rendered only decorative tick marks.
2. `metrics` and `source_text` editing lived only in `ScannedIdentityEditor` on the workbench, mounted only during active scan.
3. Three Map inspectors retained `onGoToWorkbench` handoffs that conditionally landed on a useful destination (only during scan), silently fell through to an empty intake page otherwise.

Two follow-up commits closed the immediate breakage:
- Handoff deletions (`BulletInspector`, `RoleInspector`, `ProfileInspector` — and the dispatcher's `goToWorkbench` handler)
- Role-card decomposition with bullets visible+selectable inline (`RolesBand.tsx` now renders bullet rows under each role on selection)

Outside review then made the underlying architectural choice explicit. The decision: **Strategy D — Map-only canonical workspace, with form-factor variation by content density**, sequenced as phases.

## Strategy D — refined framing

The reviewer's original framing was "multi-shape primitive (aside + expanded card + modal/sheet)." Refined to:

- **Two editor primitives**: aside (default — compact fields) and sheet (slide-in — high-content fields like `source_text`, long philosophy text). Sheet preserves context: it doesn't displace the role/bullet card it's editing against.
- **One band-rendering pattern**: expand-on-select for inline drilldown (already implemented for roles → bullets). Not a third primitive, just how bands render their children.
- **Sequenced phases**, not one big rewrite. Each phase stands alone; reverting any one doesn't break the rest.

## End state

- Map is the only canonical-edit surface for the identity model.
- `ScannedIdentityEditor` is deleted; its keep-worthy features (e.g., per-bullet deepen, metrics editing) have Map-side homes; its scan-only features (parser warnings, edit-tracking) retire with it.
- The workbench route exists only for the import pipeline. Its final form factor (full-page route, ephemeral overlay, sheet flow) is decided after the sheet primitive lands and its UX feel is known.
- Every `onGoToWorkbench` (or equivalent) canonical handoff is gone from Map inspectors.

## Subtasks

- **TASK-202.1** — Add sheet primitive, canary on `source_text`. Proves the form-factor choice before extending.
- **TASK-202.2** — Field-by-field decision matrix and lift for `ScannedIdentityEditor` features.
- **TASK-202.3** — Retire `ScannedIdentityEditor` after the lift completes (depends on TASK-202.2).
- **TASK-243** — Decide and execute the import flow's final form factor; promoted from DRAFT-2 after TASK-202.1 informed the choice.

## Out of scope

- **TASK-200** (Phase 2 sad-path test coverage) — orthogonal.
- TASK-195's deferred decisions (accuracy rules CRUD, AI-generate UI, autofill empty-state hints) — re-open on their own user-signal triggers, not part of this work.
- ProfileInspector's "Generate variant" affordance — deleted with the handoffs; needs a Map-side home when AI generation work returns; track separately when that work starts.

## Prerequisites already shipped

- Handoff deletions (`onGoToWorkbench` removed from `BulletInspector`, `RoleInspector`, `ProfileInspector`, `IdentityInspector`).
- Bullets visible and selectable on Map (`RolesBand.tsx` now renders a `role-bullets-list` under each role's header; clicking a bullet sets `mapSelection.type === 'bullet'` which routes to `BulletInspector`).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Sheet primitive exists as a reusable pattern in inspectorSlots/ (or shared primitives location), with Save/Cancel/Discard semantics matching the existing inspector edit-mode pattern
- [x] #2 BulletInspector covers all canonical bullet fields including metrics (likely inline aside fields) and source_text (likely via sheet primitive)
- [x] #3 ScannedIdentityEditor.tsx is deleted; its features either lifted to Map-side homes or recorded as scan-only-and-retired with reasoning
- [x] #4 Workbench route exists only for import; its final form factor (route / overlay / sheet) is decided and shipped, with auto-redirect to Map after Apply
- [x] #5 No onGoToWorkbench or equivalent canonical-handoff buttons exist on Map inspectors
- [x] #6 Per-bullet deepen action (if kept by TASK-202.2's decision) has a Map-side surface; if retired, the decision is recorded
- [x] #7 All four subtasks closed; tests cover the sheet primitive, the lifted editors, and the import-flow rework
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Approved sequencing (2026-04-30)

Strategy D delivered as the three already-filed subtasks, executed in order. Each phase is gated by user review of the prior phase's output:

1. **TASK-202.1** — Build the sheet primitive and canary it on bullet `source_text` editing. Form-factor decisions live here so they inform downstream lifts.
2. **TASK-202.2** — Audit `ScannedIdentityEditor`, produce the lift/scan-only/retire matrix, then execute lifts. Each lift is its own atomic commit.
3. **TASK-202.3** — Retire or reduce `ScannedIdentityEditor` based on 202.2's survivor list.
4. **TASK-243** — Promote and execute the import-flow form-factor decision after 202.1 makes the sheet feel concrete.

## Pattern guard (do not violate)

The sheet is a UI transport for an existing slot's edit mode (e.g., one of `BulletInspector`'s edit affordances). It is NOT a new `MapSelection` discriminant or a new slot file. The dispatcher's `selection satisfies never` exhaustiveness check at `IdentityInspector.tsx:140` depends on slots = discriminants, 1:1. Adding `SourceTextSheet` or `MetricsSheet` slot files would dilute that guarantee.

## Out of scope (explicitly)

- TASK-200 (sad-path tests for Phase 2)
- TASK-195's deferred decisions (accuracy rules CRUD, AI-generate UI)
- ProfileInspector "Generate variant" — needs Map-side home, tracked separately when AI-generation work resumes
- Any silent scope expansion. New surface area discovered mid-flight pauses the loop and surfaces options.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Pattern-fluency note for the implementer

The codebase has an established convention: **one component per `MapSelection` discriminant** under `src/routes/identity/inspectorSlots/`. The dispatcher (`IdentityInspector.tsx`) routes selections to slots; slots own their own edit/read modes. Examples: `BulletInspector`, `SearchVectorInspector`, `MatchRuleInspector`.

**The sheet primitive being added in TASK-202.1 is a transport for a slot's edit mode, not a replacement for the slot pattern.**

Concretely: when TASK-202.2 lifts `source_text` editing to canonical, the sheet is *how* `BulletInspector`'s source_text edit-mode renders — not a new `SourceTextInspector` slot. The slot stays `BulletInspector`; one of its edit affordances uses the sheet form factor.

If a future implementer is tempted to reach for a `SourceTextSheet` or `MetricsSheet` as standalone slots, redirect: the slot is whatever `MapSelection` discriminant the data lives under. The sheet is a UI transport for that slot's edit mode.

This matters because the slot pattern (one file per discriminant) is what keeps the dispatcher trivially typesafe via the `selection satisfies never` exhaustiveness check at the end of `IdentityInspector.tsx`'s switch. Adding new slot files for "transport variants" would dilute that check and decouple form factor from data shape, which is the wrong axis to vary on.

## Closeout — 2026-05-08

Strategy D is complete:

- TASK-202.1 shipped the reusable `InspectorSheet` primitive and canaried it on bullet `source_text`.
- TASK-202.2 recorded the full scan-editor lift/scan-only/retire matrix and lifted canonical bullet `metrics` editing into `BulletInspector`; per-bullet deepen already had its Map-side surface.
- TASK-202.3 renamed/reduced the scan-only surface to `ScanReviewPane`, removing `ScannedIdentityEditor.tsx` from source references while keeping active import reconciliation behavior isolated to scan review.
- TASK-243 promoted DRAFT-2, chose the route-but-ephemeral form factor, renamed the route to `/identity/import`, and redirects back to `/identity` after Apply.

Verification receipts across the subtasks: focused Vitest coverage for `BulletInspector`, `IdentityMapPage`, `IdentityPage`, prep draft handoff, and the sheet primitive; `npm run typecheck`; targeted ESLint; format check; `npm run build`. Full-suite debt remains tracked outside this parent and was treated as non-gating per rollout direction.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
