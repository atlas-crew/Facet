---
id: TASK-263
title: Proposed-vectors review pane and acceptance flow
status: Done
assignee:
  - '@claude'
created_date: '2026-05-11 05:20'
updated_date: '2026-05-11 11:41'
labels:
  - feature
  - identity
  - multi-source-intake
milestone: m-33
dependencies:
  - TASK-262
modified_files:
  - src/routes/identity/ProposedVectorsCard.tsx
  - src/routes/identity/IdentityPage.tsx
  - src/store/identityStore.ts
  - src/types/identity.ts
  - src/test/ProposedVectorsCard.test.tsx
  - src/routes/identity/identity.css
priority: high
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a "Proposed Vectors" review surface to the Identity page that displays AI-inferred positioning vectors from multi-source synthesis and lets the user explicitly accept, edit, or reject each one. Accepted vectors land in `identity.search_vectors[]`; rejected vectors are discarded; the staging slot clears on draft acceptance.

CONTEXT (load-bearing decisions from m-33 milestone):
- "Wrong confident-AI output is worse than blank fields" applies hardest to vectors. A bad vector poisons every downstream resume assembled for that angle. EXPLICIT USER ACCEPTANCE is mandatory; no auto-write.
- This UI is the PROTOTYPE for the broader "AI-proposed identity fragment" pattern. When agent-dump arrives in Phase 3, Self Model suggestions will follow the same review-and-accept shape. Layout this pane with a future neighbor in mind so the second instance is a copy, not a redesign.

UI SHAPE (sketch):
- Section appears above ScanReviewPane when draft.proposedVectors is non-empty; hidden otherwise.
- Each proposed vector renders as a card showing: title, thesis, supporting_bullets (with role/bullet labels resolved), evidence_sources (e.g., "2 resumes labeled platform"), and three actions: Accept, Edit, Reject.
- Accept: validates the vector shape, promotes to draft.identity.search_vectors[] with proper id assignment, removes from staging.
- Edit: inline editor for title/thesis/keywords; user must save before accepting.
- Reject: removes from staging without promotion.

STORE SHAPE:
- draft.proposedVectors: ProposedSearchVector[] (transient on the draft, not persisted on identity).
- Selectors: hasProposedVectors, getProposedVectorById.
- Actions: acceptProposedVector(id), rejectProposedVector(id), editProposedVector(id, patch).

REFERENCES:
- Existing draft review surface: src/routes/identity/ScanReviewPane.tsx
- Existing identity page composition: src/routes/identity/IdentityPage.tsx
- ProfessionalSearchVector schema: src/identity/schema.ts (use the existing supporting_bullets field)
- Task 3 emits draft.proposedVectors
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 New component src/routes/identity/ProposedVectorsCard.tsx (or similarly-named) renders proposed vectors as a list of cards
- [x] #2 Component appears in IdentityPage above ScanReviewPane only when draft.proposedVectors is non-empty
- [x] #3 Each card displays: title, thesis, supporting_bullets resolved to readable role/bullet labels, evidence_sources strings, and three action buttons
- [x] #4 Accept action promotes the vector to draft.identity.search_vectors[], assigning a stable id; removes from staging
- [x] #5 Reject action removes the vector from staging without identity changes
- [x] #6 Edit action opens an inline form for title/thesis/keywords; save validates and updates staging; cancel discards local edits
- [x] #7 Empty staging slot hides the pane entirely (does not render an empty container)
- [x] #8 Accepting all or rejecting all does not leave orphan state; draft.proposedVectors becomes []
- [x] #9 When draft is applied to identity, any remaining proposedVectors are NOT carried over (the user must accept before applying)
- [x] #10 Tests cover: render with proposed vectors, accept promotion to search_vectors, reject removal, edit-then-accept flow, empty-state hiding, draft-application clears staging
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation plan

### Placement
`<ProposedVectorsCard />` renders at the **top of `identity-section-stack`** in `IdentityPage`, above the enrichment banner and workbench grid. Sibling-depth with future Phase-3 Self Model proposal panes.

### Files
1. **`src/types/identity.ts`** — add `ProposedSearchVectorPatch` type (partial of `title`, `thesis`, `keywords`).
2. **`src/store/identityStore.ts`** —
   - Actions: `acceptProposedVector(id)`, `rejectProposedVector(id)`, `editProposedVector(id, patch)`.
   - Accept: strip `evidenceSources`, mint fresh `createId('search-vector')`, push to `draft.identity.search_vectors`, splice from staging, re-derive `draftDocument`.
   - Update `applyDraft` to drop `draft.proposedVectors` after apply (AC #9).
   - Export selectors `hasProposedVectors(state)`, `getProposedVectorById(state, id)`.
3. **`src/routes/identity/ProposedVectorsCard.tsx`** (new) — section + card per vector with title, thesis, supporting_bullets (resolved via `resolveBulletLabel`), evidence sources, and three actions. Inline edit form covers title/thesis/keywords only (priority/subtitle/target_roles stay read-only).
4. **`src/routes/identity/IdentityPage.tsx`** — read `draft`, wire store handlers, render `ProposedVectorsCard` at top of stack. Set page notice on each action.
5. **`src/routes/identity/identity.css`** — reuse existing card/btn/chip/field classes; add `identity-proposed-vectors` wrapper for spacing if needed.
6. **`src/test/ProposedVectorsCard.test.tsx`** (new) — covers AC #10: render, accept, reject, edit-then-accept, empty-state hiding, draft-application clears staging.

### Test approach
Mount with real `useIdentityStore` (via `setState` to seed draft), exercise via `fireEvent`, assert via Testing Library role/text queries — mirrors `IdentityPage.test.tsx` style.

### Risks
- `supporting_bullets` may carry bullet IDs *or* free strings; `resolveBulletLabel` falls back to the raw value when no `role.bullets[].id` matches.
- Staged vector edits must NOT bump `model_revision` — they live on draft, outside the identity revision counter.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation notes

### Files landed

1. **`src/types/identity.ts`** — added `ProposedSearchVectorPatch` (partial of `title`, `thesis`, `keywords`). Priority/subtitle/target_roles/supporting_bullets intentionally NOT in patch surface — editor scope locked to AC #6 wording.

2. **`src/store/identityStore.ts`** — three new actions plus two selectors plus `applyDraft` clear-on-apply:
   - `acceptProposedVector(id)` — strips `evidenceSources`, mints fresh `createId('search-vector')`, pushes onto `draft.identity.search_vectors`, splices from staging, re-derives `draftDocument`.
   - `rejectProposedVector(id)` — splices from staging only.
   - `editProposedVector(id, patch)` — shallow merges patch fields. Staged edits do NOT bump `model_revision` (lives on draft, outside the revision counter).
   - Empty staging arrays normalize to `undefined` so `hasProposedVectors` and the component's null-render check both work off the same sentinel.
   - Exported selectors `hasProposedVectors(state)` and `getProposedVectorById(state, id)`.
   - `applyDraft` now sets `draft.proposedVectors` to `undefined` after the identity applies (AC #9). Existing readers that already handled the optional field continue to work unchanged.

3. **`src/routes/identity/ProposedVectorsCard.tsx`** (new) — section + per-vector article cards with:
   - Heading, thesis, priority chip, primary/secondary keyword chips.
   - `supporting_bullets` resolved to "Company · Title · Bullet N" via `resolveBulletLabel`; falls back to the raw value when no `role.bullets[].id` matches (so free-form LLM output isn't lost).
   - `evidenceSources` rendered as a separate "Evidence sources" list (informational chips, not user-editable per the patch scope).
   - Three action buttons (Accept / Edit / Reject).
   - Inline edit form covers title/thesis/primary/secondary keywords with empty-title/empty-thesis validation and a discard-on-Cancel path.
   - Returns `null` when `draft?.proposedVectors` is empty/undefined (AC #7).

4. **`src/routes/identity/IdentityPage.tsx`** — wired store actions, added three handlers that emit page notices, rendered `<ProposedVectorsCard />` at the top of `identity-section-stack` above the enrichment banner and workbench grid (per user-chosen placement).

5. **`src/routes/identity/identity.css`** — minimal additions (`.identity-proposed-vectors`, `.identity-proposed-vectors-header`, `.identity-proposed-vectors-list`, `.identity-proposed-vector*`). Reuses `identity-card`, `identity-btn*`, `identity-chip*`, `identity-field*`, `identity-label`, `identity-input`, `identity-textarea`, `identity-muted` patterns — no new tokens.

6. **`src/test/ProposedVectorsCard.test.tsx`** (new) — 12 tests covering AC #10:
   - Render with proposed vectors (header, title, thesis, resolved supporting_bullet, evidence sources, three buttons).
   - Empty staging hides the pane (no DOM rendered).
   - Null draft hides the pane.
   - Raw-string fallback in `resolveBulletLabel`.
   - Accept promotes to `search_vectors`, strips `evidenceSources`, re-ids, re-derives `draftDocument`.
   - Accept preserves remaining staged vectors.
   - Reject removes from staging without touching identity.
   - Edit opens editor, saves patch, closes editor, shows updated values.
   - Edit validation error keeps editor open and leaves store untouched.
   - Cancel discards local edits.
   - Edit-then-accept flow promotes the edited shape.
   - `applyDraft('replace')` while staging is non-empty drops staging entirely and unmounts the pane.

### Test approach

Mounted a tiny harness (`ProposedVectorsCardHarness`) that wires the real `useIdentityStore` actions into the component. Tests exercise via `fireEvent` and assert via Testing Library role/text queries. No store mocking — actual reducer paths run on every click, so AC #4/5/6/9 store behaviors are covered by user interactions rather than direct `getState()` mutation.

### Verification

- `npm run typecheck` → clean.
- `npx eslint` on all six touched files → no warnings or errors.
- `npx vitest run src/test/ProposedVectorsCard.test.tsx` → **12/12 passing**.
- `npx vitest run src/test/identityStore.test.ts src/test/IdentityPage.test.tsx src/test/identityMerge.test.ts src/test/identityExtraction.test.ts` → 150/150 passing (no regressions on adjacent suites).
- `npm run test` → **2418/2418 passing** (2406 prior + 12 new).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the proposed-vectors review surface that lets users explicitly accept, edit, or reject AI-inferred positioning vectors before they enter the identity model — the load-bearing gate from m-33 LOCKED decision #2 ("inferred vectors land in a review pane for explicit acceptance, never auto-write").

**Component** `ProposedVectorsCard` renders at the top of `identity-section-stack` in IdentityPage. Each staged vector shows title, thesis, priority, keyword chips, supporting_bullets resolved to readable role/bullet labels, and evidence sources. Three actions per card: Accept (promotes to `draft.identity.search_vectors[]` with a fresh `createId('search-vector')`, strips `evidenceSources`, removes from staging), Edit (inline form for title/thesis/keywords with empty-title/thesis validation and discard-on-Cancel), and Reject (removes from staging only). Empty staging returns `null` — no empty container ever renders.

**Store** added `acceptProposedVector`, `rejectProposedVector`, `editProposedVector` actions plus `hasProposedVectors` and `getProposedVectorById` selectors. `applyDraft` now clears `draft.proposedVectors` after the identity applies, satisfying AC #9 (unaccepted vectors never ride along into the live identity). Staged edits stay off the `model_revision` counter since they live on the draft.

**Pattern prototype** This card is the template for future Phase-3 Self Model suggestion surfaces. Sibling placement at section-stack depth (not nested in ExtractionAgentCard) keeps the second instance a structural copy rather than a redesign.

**Tests** 12 new tests in `ProposedVectorsCard.test.tsx` cover every AC #10 scenario by mounting the component through a harness that wires the real store actions — store mutations and component behavior validated through the same user-driven path. Full suite 2418/2418 passing (2406 prior + 12 new). Typecheck clean. Lint clean on all touched files.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 Automatic formatting was applied to touched files
- [x] #4 Regression tests pass (scoped to touched files)
- [x] #5 Linters report no warnings or errors in touched files
- [x] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
