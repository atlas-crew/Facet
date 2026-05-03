---
id: doc-35
title: Thesis Map — Backgrounder for UX Review and Implementation Continuation
type: other
created_date: '2026-04-30 18:19'
---
# Thesis Map — Backgrounder

Status as of 2026-04-30. Phases 1 and 2 shipped; Phases 3–5 pending.

## Executive summary

The `SearchThesis` is a 12-cluster strategy artifact (narrative, competitive moat, unfair advantages, search lanes, keyword combinations, look-for/avoid signals, skill-depth calibration, per-search overrides, timeline, provenance) generated from the user's Identity model and used to drive deep-research jobs. Until recently it was rendered as a ~700-line inline form on the Search Launcher tab in `src/routes/research/ResearchPage.tsx`. The form was dense, navigation was linear, and the user flagged it as "incredibly comprehensive — needs its own map like the new identity map."

We're migrating thesis editing from the inline form to a band/inspector layout — the same pattern that worked for the Identity Map at `src/routes/identity/IdentityMapPage.tsx`. Stacked color-coded bands on a canvas, sticky right-side inspector, focused edit slots per selection.

The migration ships in **5 phases over a "scoped first cut"** that covers 3 of 7 thesis sections (Strategy, Lanes, Calibration). The other 4 sections (Advantages, Signals, Overrides, Provenance) stay on the legacy inline form until a follow-up plan migrates them. Plan file: `/Users/nick/.claude/plans/lets-plan-the-full-nested-crescent.md`.

## Where we are

| Phase | Status | Key surface | Tests |
|---|---|---|---|
| 1 — Foundation: types, store, 4th tab placeholder | ✅ Shipped | `/research?tab=thesis-map` (placeholder) | 1722 passing |
| 2 — Strategy band + 4 inspector slots | ✅ Shipped | Strategy band live, narrative/moat/interview-strategy/timeline editable | 1732 passing |
| 3 — Lanes band + LaneInspector + cascading store mutator | ⏳ Pending | Edit/move/remove lanes; cascade into requests.focusLanes and keyword combos | — |
| 4 — Calibration band + SkillDepthInspector + writeback dialog | ⏳ Pending | Per-skill calibration editing; "Write back to Identity" dialog repositioning | — |
| 5 — Test sweep + legacy form trim | ⏳ Pending | Delete migrated sections from inline form; rewrite ~10–15 tests | — |

## Reference architecture: the pattern we mirror

Identity Map established the band/inspector pattern. The Thesis Map mirrors it.

**Pattern files:**
- `src/routes/identity/IdentityMapPage.tsx` — page shell: top bar, identity headline, stacked bands, sticky inspector, footer.
- `src/routes/identity/IdentityInspector.tsx` — dispatcher reads `useIdentityStore.mapSelection`, switches to a slot per discriminant, uses `key=` for remount-on-selection-change.
- `src/routes/identity/IdentityBand.tsx` — shared wrapper: `data-layer={layer}` drives `--band-color`, head row, content slot.
- `src/routes/identity/bands/{ThesisBand,SelfModelBand,ProfilesBand,RolesBand,SkillsBand,PreferencesBand,SearchStrategyBand}.tsx` — one file per band; clickable items dispatch `setMapSelection`.
- `src/routes/identity/inspectorSlots/{...}.tsx` — one file per discriminant; uses `slotPrimitives` (`SlotShell`, `MetaRows`, `Actions`, `NotFound`).
- `src/routes/identity/inspectorSlots/MatchRuleInspector.tsx` — canonical example of the per-slot edit-commit pattern; recently extended with the `justAdded` flag for Discard-vs-Cancel UX on freshly-added stubs.
- `src/store/identityStore.ts:536-585` — `isMapSelectionValid` template.
- Layer color tokens in `src/index.css` lines 116–127, 181–189, 240–248 (default + light + dark).

## Architectural decisions (numbered, with rationale)

### D1. Tab placement: 4th tab inside `<ResearchPage>`, not a new route

The Map sits between Profile Editor and Search Launcher. Tab order: **Profile Editor → Thesis Map → Search Launcher → Results Viewer**.

A route restructure (turning `<ResearchPage>` into a layout with sub-routes) is meaningful refactor scope that doesn't align with the scoped-cut philosophy. A 4th tab is reversible and reuses the `.research-panel[hidden] { display: none }` mechanism already correct after a recent fix (`src/routes/research/research.css`). Promoting to its own route can be a separate decision after cut 1 ships and we have feedback.

References: `src/routes/research/ResearchPage.tsx:81-82` (`ResearchTab` union, `RESEARCH_TABS`), `src/routes/research/ResearchPage.tsx:2389-2410` (tab list rendering).

### D2. Selection state lives on `useSearchStore`

Mirrors Identity's `useIdentityStore.mapSelection` exactly. Store-level state because bands and inspector are siblings; local state would force prop drilling. Excluded from `src/persistence/snapshot.ts` (UI ephemera, never persisted across reloads). `setActiveThesis` clears `mapSelection` on thesis switch.

References: `src/store/searchStore.ts:36-77` (state interface includes `mapSelection`, `setMapSelection`, `removeThesisLane`), `src/store/searchStore.ts:128-155` (`isThesisMapSelectionValid` validator), `src/store/searchStore.ts:573-580` (`setActiveThesis` clears selection).

### D3. Discriminated union for `ThesisMapSelection` (scoped to first cut)

```ts
export type ThesisMapSelection =
  | { type: 'narrative' }
  | { type: 'moat' }
  | { type: 'interview-strategy' }
  | { type: 'timeline' }                  // composite (urgency/deadline/strategyImpact)
  | { type: 'lane'; id: string }
  | { type: 'skill-depth'; index: number } // index-keyed (mirrors arc-stop in identity)
```

Selections for Advantages, Signals, Overrides, Provenance are **deliberately deferred** to the next plan. Reference: `src/types/thesisMap.ts:21-29`.

### D4. Edit-commit semantics: per-slot immediate commit (eliminates `thesisDraft` for migrated fields)

Each inspector slot writes directly to the active thesis via `saveThesisRevision`. No global Save/Discard for migrated fields. Slot Save commits; Cancel discards local state and re-reads from active.

`saveThesisRevision` is partial-merge (`src/store/searchStore.ts:443-471`), so the legacy form's existing global Save/Discard for the four un-migrated sections continues to work in parallel: legacy form patches Advantages + Signals + Overrides + Provenance only; Map patches Strategy + Lanes + Calibration only. Patches don't overlap.

User chose this over preserving the global Save/Discard contract: matches Identity Map UX, eliminates `thesisDraft` complexity, smallest state surface.

### D5. Generate/Regenerate stays on Profile Editor (not on the Map)

The existing `<SearchThesisWorkspace>` card stays where it is; the post-generate auto-switch retargets from the Search Launcher tab to the new Thesis Map tab. Reference: `src/routes/research/ResearchPage.tsx:1226` (renamed `switchToSearchTab` → `switchToThesisMap`), `src/routes/research/ResearchPage.tsx:2445` (call site uses new flag).

User chose this over moving generate into Map slots: keeps existing flow intact, smaller refactor.

### D6. Cohabitation safety via id-gated rehydrate (the central correctness mechanism)

`ResearchPage.tsx`'s rehydrate effect at lines 812–832 used to depend on `[activeThesis]`. Every Map save calls `saveThesisRevision`, which produces a new `activeThesis` reference — without dependency correction, the rehydrate would clobber any in-flight legacy-form drafts (advantages/signals/overrides) on every Map edit.

**Fix shipped in Phase 2**: change dependency to `[activeThesisId]`. Rehydrate fires only on thesis switch, not on content updates. Reference: `src/routes/research/ResearchPage.tsx:812-832`.

This is the load-bearing change that makes Map ↔ legacy-form cohabitation safe.

### D7. `MAP_OWNED_THESIS_FIELDS` constant (Amendment 1 from multi-perspective review)

Single source of truth for which fields the Map owns. Used today as documentation; available for future selective-rehydrate logic. Reference: `src/types/thesisMap.ts:40-48`.

### D8. `useSlotSaveGuard` hook (Amendment 4a)

Captures `activeThesis.id` on slot mount via `useRef`. Save handlers call `bailIfThesisChanged(currentId)` before committing — closes the regenerate-mid-edit race where a user types into thesis A's slot while Profile Editor's Generate Thesis fires and replaces `activeThesisId`. References: `src/hooks/useSlotSaveGuard.ts`, used in `src/routes/research/inspectorSlots/{Narrative,Moat,InterviewStrategy,Timeline}Inspector.tsx`.

### D9. `removeThesisLane` cascading mutator (Amendment 4b)

Lane removal cascades atomically: (1) thesis's `searchLanes` filter, (2) `keywordCombinations` cascade-delete by `lane`, (3) `requests[].focusLanes` strip. The cascade refuses to fire when an active research job is running against the same thesis (returns `{ blocked: true, reason: 'in-flight-job' }`) — the slot surfaces a notice with a cancel-job action. Reference: `src/store/searchStore.ts:583-633`.

### D10. Layer colors

3 new tokens for the migrating bands:
- `--layer-strategy: var(--accent-primary)` (cyan-ish blue)
- `--layer-lanes: var(--success)` (green)
- `--layer-calibration: #be185d / #d946ef` (magenta)

References: `src/index.css:128-132` (default scope), `src/index.css:189-193` (light theme), `src/index.css:248-252` (dark theme).

## Multi-perspective review outcome

Before Phase 1 shipped, the plan was pressure-tested through four expert lenses (Senior React engineer, UX designer, project manager, search/research domain expert). Four amendments emerged:

| Amendment | Source | Status |
|---|---|---|
| 1 — `MAP_OWNED_THESIS_FIELDS` constant | Engineer | ✅ Accepted |
| 2 — Drop Calibration from cut 1 | PM | ❌ Declined (user kept Calibration in scope) |
| 3 — Hard ship date for cut 2 | PM | ❌ Declined (user accepted "second cut will happen" assumption) |
| 4a — `useSlotSaveGuard` for regenerate-mid-edit race | Engineer | ✅ Accepted |
| 4b — `removeThesisLane` in-flight-job guard | Engineer | ✅ Accepted |

UX-perspective dissents recorded but declined for cut 1:
- "Map should be first tab, not second." Defer to a future tab-order revision.
- "Lanes + Keyword Combinations + Avoid should be one band, not split." Defer to cut 2 design.
- "Calibration as its own band may be over-elevated." Defer to cut 2 design.

Search/research domain dissents recorded but declined for cut 1:
- "Provenance band is dead weight; should be a header strip not a band." Defer to cut 2 design.
- "Iteration order should be most-edited-first (lanes), not narrative-first." Defer.

These are flagged here so a UX reviewer knows what was deliberately not addressed in cut 1.

## Side work shipped alongside the Map plan

Not part of the formal phases but relevant context:

### S1. `<SearchInstancePreferences>` — disabled-fieldset → empty-state CTA

Inputs in the THIS SEARCH column looked editable but didn't react when no active thesis existed (HTML `<fieldset disabled>` rendered nearly identically to enabled inputs in dark theme). Replaced the disabled fieldset with an explicit "Generate a thesis to enable per-search overrides" card. Reference: `src/routes/research/searchWorkspaceComponents.tsx:413-563`.

### S2. Skills card layout follow-up logged

User flagged "wasted space" + missing restore affordance for hidden skills. Logged as `task-201` for separate Profile Editor cleanup pass. Not in the Map plan.

### S3. `strategyEditorAutofill` retired

Earlier in this work stream, the deleted `IdentityStrategyWorkbench` was retiring its bulk-fill heuristics. The `strategyEditorAutofill` module shipped template strings (`"The process leaves room to demonstrate ..."`, `"The process over-indexes on ... instead of job-relevant work."`) that polluted user identities. Module removed; runtime normalizer added in `src/identity/schema.ts:328-378` to strip the leftover prefixes from `interview_process.strong_fit_signals` / `red_flags` on every load.

### S4. Phase A of search-vector lanes migration

Earlier in this work stream, `SearchRequest.focusLanes: string[]` was added alongside the legacy `focusVectors`. The launcher renders lane checkboxes when an active thesis exists; both pickers feed the same request. Phases B/C/D queued in backlog as `task-197` / `task-198` / `task-199`.

### S5. AI working indicators

Two new primitives: `useElapsed` hook (live timer) and `<AiWorkingStatus>` component (card-level "AI is working" indicator with elapsed counter, optional caption, indeterminate bar, extended-wait copy after a configurable threshold). Plus a shimmer effect on `.ai-working-button[aria-busy='true']`. Wired into thesis generation, profile inference, and bulk-deepen flows. References: `src/hooks/useElapsed.ts`, `src/components/AiWorkingStatus.tsx`, `src/components/aiActivity.css`.

## Phase 1 — Foundation (shipped)

**New files:**
- `src/types/thesisMap.ts` — discriminated union, `MAP_OWNED_THESIS_FIELDS`
- `src/hooks/useSlotSaveGuard.ts` — capture-on-mount + bail-on-change
- `src/routes/research/ThesisMapPanel.tsx` — page shell, empty state
- `src/routes/research/ThesisMapPanel.css` — layout, layer colors, slot styles

**Modified files:**
- `src/store/searchStore.ts` — `mapSelection` state, `setMapSelection`, `isThesisMapSelectionValid`, `removeThesisLane`, `setActiveThesis` clears selection
- `src/index.css` — 3 layer color CSS variables (default/light/dark)
- `src/routes/research/ResearchPage.tsx` — 4th tab; placeholder mounted; `switchToSearchTab` → `switchToThesisMap`
- `src/test/ResearchPage.test.tsx` — keyboard navigation extended for 4 tabs; thesis-edit test routes back to Search Launcher after auto-switch

## Phase 2 — Strategy band (shipped)

**New files:**
- `src/utils/thesisFillStrength.ts` — `strategyFillStrength`
- `src/routes/research/ThesisBand.tsx` — shared wrapper
- `src/routes/research/ThesisInspector.tsx` — dispatcher with Phase 3/4 placeholders
- `src/routes/research/inspectorSlots/slotPrimitives.tsx` — generic primitives
- `src/routes/research/inspectorSlots/NarrativeInspector.tsx`
- `src/routes/research/inspectorSlots/MoatInspector.tsx`
- `src/routes/research/inspectorSlots/InterviewStrategyInspector.tsx`
- `src/routes/research/inspectorSlots/TimelineInspector.tsx` — composite slot with urgency-toggle preservation
- `src/routes/research/bands/ThesisStrategyBand.tsx` — 2×2 card grid
- `src/test/ThesisMapPanel.test.tsx` — 8 tests covering empty state, all 4 slots, save round-trip, cancel preservation, timeline validator, selection clear on thesis switch

**Modified files:**
- `src/routes/research/ResearchPage.tsx:812-832` — rehydrate dependency change `[activeThesis] → [activeThesisId]` (the central cohabitation safety mechanism)
- `src/routes/research/ThesisMapPanel.tsx` — mounts `<ThesisStrategyBand>` + `<ThesisInspector>`
- `src/routes/research/ThesisMapPanel.css` — band wrapper, card grid, full inspector slot styling

## Phase 3 — Lanes band (pending)

**Scope:**
- `<ThesisLanesBand>` — lane cards (title + first-sentence rationale + targetSignals tags); "+ Add lane" trailing button auto-selects new lane.
- `<LaneInspector>` slot — title, rationale, competitiveContext, targetSignals (csv), Move up/down/Remove.
- `lanesFillStrength` helper — count of lanes with rationale ≥ 2 sentences AND targetSignals ≥ 1; tone warn if any lane lacks corresponding keyword combinations.
- Trim Lanes form section from `ResearchPage.tsx:2957-3046`.
- Lift `removeThesisLane`/`addThesisLane`/`moveThesisLane`/`updateThesisLane` page handlers into the store (already partially done — `removeThesisLane` exists at `src/store/searchStore.ts:583-633`).

**`justAdded` flag pattern (from Identity Map):** when a band's add button creates a stub, it sets `mapSelection.justAdded = true`. The slot reads this and starts in editing mode; Cancel becomes "Discard" (removes the stub). Mirror this for `LaneInspector`. Discriminated union update needed: `{ type: 'lane'; id: string; justAdded?: boolean }`. Reference pattern: `src/routes/identity/inspectorSlots/MatchRuleInspector.tsx:1-67`.

**Tests:** `src/test/searchStore.thesisMap.test.ts` (cascade tests), `src/test/LaneInspector.test.tsx` (slot detail incl. in-flight-job notice).

## Phase 4 — Calibration band (pending)

**Scope:**
- `<ThesisCalibrationBand>` — skill-depth entries (skill + depth badge + first-sentence context). No add affordance (entries generated by LLM during thesis generation).
- `<SkillDepthInspector>` slot — skill, depth, context, searchSignal, calibration; "Write back to Identity" button.
- Reposition the existing skill-writeback confirmation panel (`ResearchPage.tsx:2695-2749`) so it floats as a dialog visible from any tab. Currently inline above the legacy form; needs to follow the user wherever they are.
- `calibrationFillStrength` helper — coverage of identity skills + per-entry richness; tone warn if coverage < 50% or contract violation present.
- Trim Calibration form section from `ResearchPage.tsx:3201-3285`.

**Risk flagged in plan:** writeback dialog repositioning is the trickiest piece in this phase — keyboard focus, escape-to-cancel, click-outside semantics. Acceptable fallback: keep inline + redirect notice on the Map slot.

## Phase 5 — Test sweep + cleanup (pending)

**Scope:**
- Sweep `src/test/ResearchPage.test.tsx` (3113 lines, ~10–15 tests targeting migrated-field labels) for label-driven tests that still reach into the legacy form's narrative/lane/skill-depth fields. Rewrite to drive the Map: `setMapSelection({ type: 'narrative' })`, then assert against the slot.
- Update tests pinning `activeTab === 'search'` for thesis editing to use `'thesis-map'`.
- Add `searchStore.thesisMap.test.ts` cascade tests for `removeThesisLane` (3-place atomic cascade + in-flight-job block).
- Run full suite, address regressions, run lint, run build.

**The riskiest single piece of the migration** per multi-perspective review. 1-day budget per plan, but realistic estimate is 1.5–2 days. If sweep blows past 1 day, accept a 6–7 day total rather than cutting test coverage.

## Critical files for any implementer

| File | Why |
|---|---|
| `src/routes/identity/IdentityMapPage.tsx` | Page shell pattern to mirror |
| `src/routes/identity/IdentityInspector.tsx` | Dispatcher with `key=` remount conventions |
| `src/routes/identity/IdentityBand.tsx` | Shared band wrapper |
| `src/routes/identity/inspectorSlots/MatchRuleInspector.tsx` | Per-slot edit-commit pattern with `justAdded` flag |
| `src/store/identityStore.ts:536-585` | `isMapSelectionValid` template |
| `src/store/searchStore.ts:443-471, 517-633` | `saveThesisRevision`, `setActiveThesis`, `removeThesisLane` |
| `src/types/search.ts:400-466, 661` | `SearchThesis` interface, `EMPTY_SEARCH_INSTANCE_OVERRIDES` |
| `src/utils/identityFillStrength.ts` | Pattern for `thesisFillStrength.ts` |
| `src/routes/research/ResearchPage.tsx:812-832, 2773-3285` | Rehydrate effect (already gated), form sections to trim |

## Plan file

`/Users/nick/.claude/plans/lets-plan-the-full-nested-crescent.md` is the source of truth for phase scope, acceptance criteria, and risk catalog. The amendments and the corrected rehydrate-direction (`[activeThesis]` → `[activeThesisId]`) are documented inline.

---

# UX review questions

Twelve questions for an outside UX reviewer. Group into product-strategy questions and surface-level questions.

## Product-strategy questions (cut 2 framing)

These determine the long-term shape of the Map. Cut 1 is committed to a 7-band schema-mirror layout; cut 2 redesign decisions land later.

1. **Tab order.** Profile Editor → Thesis Map → Search Launcher → Results Viewer is the current sequence. Domain-expert review argued the thesis is the central artifact and should be tab #1. Should we reorder when full migration ships, or does Profile-first match a real onboarding flow?

2. **Band groupings — schema-mirror vs iteration-loop.** The 7 bands today (Strategy, Advantages, Lanes, Signals, Calibration, Overrides, Provenance) reflect schema clusters. A domain-expert critique argued for collapsing **Lanes + Keyword Combinations + Avoid into one "Lanes & Tactics" band** since the user iterates on a positioning angle as a whole. Cut 1 ships schema-mirror; should cut 2 reorganize?

3. **Provenance as a band vs a status strip.** `source`, `identityVersion`, `feedbackIncorporated`, `stalenessReview` are read-mostly metadata. Currently planned as a 7th band. Domain-expert critique: "dead weight as a band; should be a header strip with an inline 'i' disclosure." Which is right?

4. **Calibration's home.** Skill-depth calibration is per-skill thesis context — but it's also conceptually identity-adjacent (skills live on identity). Should calibration ultimately live on the Identity Map's Skills band instead, or on a per-lane-card sub-section ("Skills weighted on this lane: K8s, Terraform — adjust calibration here"), or stand alone as a band?

5. **Lane focus picker location.** The Search Launcher tab has lane checkboxes for `focusLanes`. The Map's Lanes band edits lanes themselves. The user iteration "I want to focus this run on the Platform Modernization lane" requires Map-tab → click-lane → switch-tab → check-box. Should the focus picker move onto the Map's Lanes band as a per-lane checkbox, or stay on the Launcher?

## Surface-level questions (cut 1 polish)

These can be answered against the shipped Phase 1 + 2 surfaces.

6. **Empty state for the Map without a thesis.** `<ThesisMapPanel>` renders "No active thesis" with a sentence. Is this enough, or should it be a strong CTA card with a "Generate Thesis" button that routes to the Profile Editor tab (since generate lives there)?

7. **Strategy band card layout.** Currently a 2×2 grid. Each card has a label + truncated body preview. Text length varies wildly (narrative is paragraphs, moat is one sentence). Should cards be uniform-height with text truncation, or auto-grow with the longer content? Does the 2×2 grid scale to small screens?

8. **Inspector pane sticky behavior.** Currently `position: sticky; top: 0`. On long bands, the inspector stays in view as you scroll the canvas. Is the right reading-order canvas-then-inspector (vertical scroll feels like reading bands), or inspector-then-canvas (right-pane focus)?

9. **Save vs Cancel button affordances per slot.** Each slot today has Save (primary) + Cancel (secondary). Identity Map evolved a `justAdded` pattern where freshly-added stubs use Discard instead of Cancel and Discard removes the stub. Phase 3 will adopt this for lanes. Should single-block slots (narrative, moat) also gain a Discard concept, or is Cancel sufficient for "abandon this edit and revert to saved"?

10. **TimelineInspector composite UX.** The timeline slot has urgency dropdown + deadline date input + strategy-impact textarea. Setting urgency to "" (unset) preserves the deadline/impact text in local state in case you flip urgency back on; on Save, urgency-empty writes `timeline: undefined`. Is this preservation behavior discoverable, or should we add explicit copy ("Your deadline and impact will be remembered if you turn urgency off")?

11. **Validation surfacing.** `validateSearchThesis` currently runs on every save and surfaces violations as a banner above the legacy form. Cut 1 doesn't move this banner. Should violations badge the relevant Map slot (red dot on the band card)? If yes, the validator needs to return structured `{ message, target?: ThesisMapSelection }` objects — meaningful refactor.

12. **Generate flow re-entry.** Today's flow: Profile Editor → click Generate Thesis → auto-switch to Thesis Map (Phase 1 retargeted this from the old Search Launcher destination). Is auto-switch right, or should it stay on Profile Editor with a clear "View thesis →" link to the Map? Auto-switch loses the user's place; explicit nav requires more clicks.

## Bonus operational questions

These are not UX in the visual-design sense but affect end-to-end use:

13. **Cohabitation visibility.** During cuts 1+2, some thesis editing lives on the Map (Strategy/Lanes/Calibration), some lives on the legacy form (Advantages/Signals/Overrides/Provenance). How do we communicate this to the user? Top-of-Map info banner ("More thesis editing on the Search Launcher tab")? Per-band hint?

14. **Discard vs Save mental model with per-slot commits.** Currently the legacy form has a global "Save thesis edits" / "Discard edits" header. The Map has per-slot Save buttons. After cut 5 (legacy form trimmed), users lose the global Discard. Should the Map provide a "revert thesis to last generation" affordance, or is per-slot Cancel sufficient?

---

End of backgrounder.
