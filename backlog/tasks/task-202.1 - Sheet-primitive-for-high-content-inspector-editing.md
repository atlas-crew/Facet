---
id: TASK-202.1
title: Sheet primitive for high-content inspector editing
status: In Progress
assignee:
  - '@nick'
created_date: '2026-04-30 18:40'
updated_date: '2026-04-30 23:35'
labels:
  - identity
  - map-convergence
  - strategy-d
  - ui-primitive
dependencies: []
references:
  - src/routes/identity/inspectorSlots/BulletInspector.tsx
  - src/routes/identity/inspectorSlots/slotPrimitives.tsx
  - src/routes/identity/IdentityInspector.tsx
parent_task_id: TASK-202
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context (TASK-202 phase 1)

Map's inspector aside is the right primitive for compact fields (label, weight, severity) but cramped for high-content ones (long text, source_text, multi-paragraph philosophy entries). Strategy D introduces a second editor primitive — the **sheet** — that slides in alongside the aside, occupies more horizontal real estate, but **preserves the aside's context** (doesn't fully cover it; user can see what they were editing against).

This task builds the sheet primitive once and canaries it on `source_text` editing in `BulletInspector`. If the form factor feels right in practice, future content-heavy edits use the same primitive. Building this first (before TASK-202.2's lift decisions and DRAFT-2's import-flow form factor) means downstream choices are informed by real experience with the primitive, not speculation.

## Approach

- Add `InspectorSheet` (or similar) component that:
  - Opens from the inspector aside via a controlled prop / open callback
  - Renders alongside (not on top of) the aside — likely as a sibling pane that pushes the Map content area inward, leaving the aside visible
  - Closes via Save / Cancel; Cancel-after-justAdded → Discard, matching the existing inspector edit pattern
  - Does NOT remount on selection change unless the selection target itself changes (so users don't lose draft state if they accidentally click elsewhere)
- BulletInspector grows a "Edit source text" button (visible when `bullet.source_text` is non-empty or as an "Add source text" CTA when empty) that opens the sheet
- The sheet's UI is a textarea + Save/Cancel/Discard

## Open design questions to resolve in this task (record in notes)

- Sheet width: fixed (e.g., 480px) vs. fluid (e.g., 40% of viewport)?
- Sheet displacement: pushes inspector aside leftward vs. layered over the right portion of the Map content area?
- Keyboard: Esc closes? Tab order between aside and sheet?

## Out of scope

- Generalizing the sheet for other fields. That's TASK-202.2's job, informed by this canary.
- Import flow form factor. That's DRAFT-2, also informed by this canary.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 InspectorSheet component exists in inspectorSlots/ (or shared primitives location) with open / close / Save / Cancel / Discard semantics matching the existing inspector edit-mode pattern
- [ ] #2 Sheet preserves the inspector aside's context — the aside remains visible and the user can see what entity the sheet is editing against
- [x] #3 BulletInspector uses the sheet to edit source_text; opens via an explicit button, closes on Save / Cancel
- [x] #4 Sheet handles the justAdded discard pattern correctly (Cancel-on-justAdded → discard the entity, matching existing inspector behavior)
- [x] #5 Tests cover open/close lifecycle, Save persists to canonical state, Cancel reverts, Discard removes entity when justAdded
- [x] #6 Design decisions recorded in this task's notes: sheet width, displacement model, keyboard behavior
- [x] #7 Code comment in InspectorSheet documents when to use sheet vs inline aside fields (rough heuristic: ≥80 chars, multi-line, or content user wants to read while editing)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Approved plan (2026-04-30)

### Step 1 — Build `InspectorSheet` primitive + its unit test (commit 1)

**Location:** `src/routes/identity/inspectorSlots/InspectorSheet.tsx`

**API:**
```tsx
interface InspectorSheetProps {
  open: boolean
  title: string
  eyebrow?: string
  onSave: () => void
  onCancel: () => void
  onDiscard?: () => void   // present iff justAdded — Cancel renders as "Discard"
  children: ReactNode
}
```

- Renders nothing when `open === false`. When open, a `<section className="inspector-sheet">` with header (eyebrow + title), the children body, and a Save / Cancel | Discard footer.
- The sheet does NOT own draft state; the calling slot owns it. This means the sheet does not need to remount on selection change — the slot decides whether to keep open or close.
- Esc triggers `onCancel`. Initial focus lands on the first form control inside `children` (no focus trap — the aside must remain readable per Strategy D's "preserve context" goal).
- Heuristic comment block at the top documents when to use sheet vs inline aside fields: *≥80 chars, multi-line, or content user wants to read alongside the entity*.

**Layout (CSS in `identityMap.css`):**
- Map root toggles `.identity-map.has-sheet { grid-template-columns: minmax(0, 1fr) var(--inspector-sheet-width, 480px) 380px; }`
- `.inspector-sheet { position: sticky; top: 0; height: 100vh; overflow-y: auto; ... }` matching aside conventions
- `<= 1100px` breakpoint stacks the sheet column below canvas (matches existing aside collapse)

**Unit test:** `src/test/InspectorSheet.test.tsx` covers open/close, Save callback fires, Cancel callback fires, Discard variant when `onDiscard` provided, Esc-as-Cancel.

### Step 2 — Wire BulletInspector to the sheet for `source_text` (commit 2)

- Extend `BulletInspector.tsx` draft state with `sourceText`.
- Add `[sheetOpen, setSheetOpen]` local boolean.
- Add a button to the existing `Actions` row labeled **"Edit source text"** (or **"Add source text"** when `bullet.source_text?.trim()` is empty).
- The sheet body: a single `<textarea rows={12}>` for `draft.sourceText`.
- Save persists ONLY `source_text` (independent from aside-side problem/action/outcome saves). Cancel reverts.
- Bullet selections never carry `justAdded`, so the Discard variant is exercised by the primitive's own test, not the integration here.

**Integration test:** `src/test/BulletInspector.sheet.test.tsx` covers: button visibility (Add vs Edit label), opening loads current source_text, Save persists to store, Cancel reverts, sheet does not interfere with aside problem/action edit mode.

### Step 3 — Browser verification

- `npm run dev`, exercise on `/identity` with a real bullet
- Validate: Esc behavior, focus management, layout at 1280px and at 1100px breakpoint
- Record outcomes in this task's notes (width=480px, displacement=third grid column, keyboard=Esc closes)

### Step 4 — Quality gates

- `npm run typecheck` clean
- `npm run lint` clean
- `npm run test` green
- `npm run build` succeeds
- Mark each AC complete via `task_edit --check-ac` only after the proving command runs fresh

## Commit shape (atomic, Bisect-Test-passing)

1. `feat(identity): add InspectorSheet primitive` — component + CSS + heuristic comment + unit test
2. `feat(identity): canary sheet on bullet source_text editing` — BulletInspector wiring + integration test

Both commits build, both pass tests in isolation. Behavior is introduced in commit 2; commit 1 ships the primitive with its own contract test.

## Layout decision (recorded for AC #6 in advance, confirmed by browser test)

- Sheet width: **fixed 480px** (revisit after canary)
- Displacement: **third grid column** (canvas reflows; aside stays sticky/visible)
- Keyboard: **Esc closes** (calls onCancel); no focus trap (aside readable)

## Out of scope

- Generalizing sheet to other fields (TASK-202.2)
- ScannedIdentityEditor changes (TASK-202.2/202.3)
- Import flow form factor (DRAFT-2)
- New `MapSelection` discriminants (pattern guard)
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Recommended skill loadout for picking up this task

**Always-load (task-tracking and quality gates):**
- `backlog-md` — status updates, recording design-decision outcomes in these notes
- `atomic-commits` — separate the primitive component, its tests, and the BulletInspector wiring into clean commits
- `verification-before-completion` — the sheet's keyboard/focus/ARIA behavior should be confirmed in a real browser, not just typecheck
- `codanna-codebase-intelligence` — to find existing primitives in `slotPrimitives.tsx` and avoid duplicating

**Phase-specific:**
- `interaction-design` — the sheet's open/close lifecycle, focus management, and keyboard behavior are flow-design questions; this skill is the right primitive for thinking through them
- `accessibility-audit` — sheet + aside means two simultaneous live regions; tab order, ARIA roles, focus-trap-or-not need an AT pass

**Consult (sub-agents):**
- `vitest-expert` — controlled-component test patterns for opening/closing/save/cancel/discard are non-trivial; one consultation pays off
- `component-architect` — review the primitive's API before TASK-202.2 starts using it; cheaper to fix at one caller than at five

## Design decisions (resolved 2026-04-30)

- **Sheet width**: fixed 480px (CSS variable `--inspector-sheet-width` not yet introduced; literal value used). Revisit after the canary has been used in real flows; if 480 feels cramped for multi-paragraph source_text, bump to 560 or switch to fluid % before TASK-202.2 lifts more fields.
- **Displacement model**: `position: fixed` + `:has(.inspector-sheet)` driven canvas reflow. Functionally matches "third grid column" — canvas content shifts inward via `padding-right`, aside stays sticky/visible at `right: 0`. Implementation chose fixed-positioning over an actual grid column to keep the sheet's open state local to the calling slot (no page-level state lift, no React portal plumbing). The `:has()` pseudo-class is already in use elsewhere (`identity.css:676`) so browser-support is non-issue for this codebase.
- **Keyboard**: Esc fires onCancel by default; if `onDiscard` is provided (justAdded entities), Esc fires onDiscard instead. No focus trap — aside must remain readable per Strategy D's "preserve context" goal. Initial focus lands on the first focusable child inside `children` after open.
- **Lifecycle**: sheet does not own draft state — calling slot owns it. The slot decides when to close. In BulletInspector, the open state is keyed off bulletId via a derived `sheetOpen = sheetState !== null && sheetState.bulletId === bulletId`, which auto-closes the sheet when the user navigates to a different bullet without needing a side effect.
- **Responsive (≤1100px)**: sheet collapses to full-width fixed; canvas padding-right reverts to default. The "preserve context" promise weakens at narrow widths but the alternative (no editing surface for source_text on mobile) is worse.

## Verification status

- Unit tests: `src/test/InspectorSheet.test.tsx` — 9/9 pass. Covers open/close render, Save/Cancel/Discard callbacks, focus-on-open, Esc routing.
- Integration tests: `src/test/BulletInspector.sheet.test.tsx` — 8/8 pass. Covers Add vs Edit label, sheet opens with current source_text, Save persists, Cancel reverts, empty input clears the field, sheet closes on bullet selection change, source_text save is independent of aside problem/action/outcome edit mode.
- `npm run typecheck` clean (when isolated from another agent's untracked WIP `src/test/legacyThesisSave.test.ts`).
- `npm run build` clean (when isolated from same untracked WIP).
- ESLint: zero errors/warnings in files I touched.
- Browser eye-check: NOT DONE in this pass. The visual layout is mechanical (CSS rules + `:has()` reflow) and the integration tests confirm the DOM coexistence of sheet+aside, but a real-browser eye-check at 1280px and at the 1100px breakpoint is recommended before TASK-202.2 starts lifting more fields onto the sheet.

## Commits

- `096ab9c feat(identity): add InspectorSheet primitive` — CSS rules only
- `3b3be96 feat(identity): add InspectorSheet component and contract test` — TSX + unit test
- `5995736 refactor(identity): drop onGoToWorkbench handoffs from Map inspectors` — committed the prereq cleanup that the task description had marked as "already shipped" but was actually still dirty in the working tree
- `df5fae2 feat(identity): canary sheet on bullet source_text editing` — BulletInspector wiring + integration test

## Track A polish (after canary user-test pass — 2026-04-30)

User eye-checked the canary and reported two discoverability issues:

1. **Bullet rows on the Map didn't read as clickable.** Only at-rest cue was `cursor: pointer` + a small low-opacity dot — looked like a passive bullet preview.
2. **Bullet inspector buttons were below the fold and the aside's scrollability wasn't obvious** — easy to think there were no edit/deepen affordances at all.

Fixes:
- `35eb7e0 style(identity): strengthen bullet-row click affordance on Map` — three converging static signals: 2px transparent left border that fills with band-color, brighter+bigger dot (6px @ 0.7 opacity vs 4px @ 0.4), chevron suffix that fades in on hover/focus/selection.
- `537ffb6 style(identity): pin slot action rows to inspector bottom while scrolling` — `.inspector-action` rows inside `.identity-inspector` and inside `.inspector-sheet-actions` are now `position: sticky; bottom: 0` with bg-inset background and a top border. Save / Cancel / Edit / Deepen stay reachable regardless of scroll position. Scoped to slot inspectors so ad-hoc `.inspector-action` usages elsewhere are unchanged.

These live alongside this task because they were direct fallout from the canary test, but they generalise to all slot inspectors, not just BulletInspector.

## Track B early lift — Deepen action on the Map

User-flow signal during the canary test pointed at the missing AI-Deepen affordance more strongly than at the metrics editor. Lifted the per-bullet Deepen ahead of the broader 202.2 inventory.

Commits:
- `923c155 feat(identity): add canonical-bullet deepen store actions` — narrow `currentBulletDeepen: Record<key, {status, lastError?}>` slice + start/complete/fail actions, scoped to currentIdentity rather than scanResult. Source_text on the bullet is preserved across the merge so AI suggestions don't overwrite user-captured raw text.
- `fd54cfa feat(identity): canary deepen action on bullet inspector` — Deepen button in BulletInspector with disabled-with-hint labels ("Add source text first", "AI not configured", "Deepening…", "Retry deepen"); concurrent deepens blocked across the whole identity; failed deepens surface inline `role=alert` above the actions row.

Tests:
- `src/test/identityStore.deepen.test.ts` (6 tests) — store action transitions and source_text preservation
- `src/test/BulletInspector.deepen.test.tsx` (7 tests) — disabled states, success path, failure path, in-flight label, cross-bullet concurrency block

This closes part of TASK-202.2's AC #3 ("Every 'lift' feature has a Map-side home") and AC #6 ("Tests cover each lifted feature") for the Deepen feature specifically. The remaining 202.2 work is the inventory matrix and the metrics + bulk-deepen decisions.

## Updated commit list (chronological)

- `096ab9c feat(identity): add InspectorSheet primitive` — CSS
- `3b3be96 feat(identity): add InspectorSheet component and contract test` — TSX + 9 unit tests
- `5995736 refactor(identity): drop onGoToWorkbench handoffs from Map inspectors` — prereq cleanup
- `df5fae2 feat(identity): canary sheet on bullet source_text editing` — BulletInspector + 8 integration tests
- `e25339a feat(identity): decompose role cards to render bullets inline` — prereq cleanup
- `35eb7e0 style(identity): strengthen bullet-row click affordance on Map` — Track A polish
- `537ffb6 style(identity): pin slot action rows to inspector bottom while scrolling` — Track A polish
- `923c155 feat(identity): add canonical-bullet deepen store actions` — Track B store + 6 tests
- `fd54cfa feat(identity): canary deepen action on bullet inspector` — Track B wiring + 7 tests
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
