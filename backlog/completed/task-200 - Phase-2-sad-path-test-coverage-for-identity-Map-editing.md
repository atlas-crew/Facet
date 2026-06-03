---
id: TASK-200
title: Phase 2 sad-path test coverage for identity Map editing
status: Done
assignee:
  - '@codex'
created_date: '2026-04-30 10:31'
updated_date: '2026-05-08 21:20'
labels:
  - identity
  - map-convergence
  - tests
  - phase-2-followup
dependencies: []
references:
  - src/test/IdentityMapEditing.test.tsx
  - src/routes/identity/inspectorSlots/MatchRuleInspector.tsx
  - src/routes/identity/inspectorSlots/SearchVectorInspector.tsx
  - src/routes/identity/inspectorSlots/AwarenessQuestionInspector.tsx
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context

TASK-195 shipped with happy-path test coverage in `src/test/IdentityMapEditing.test.tsx` (8 cases covering add, edit, remove, toggle for match rules, search vectors, and awareness questions). A multi-perspective review after the commits landed identified four sad-path gaps that would catch real regressions. None block TASK-195's closure (the required AC #8 paths are covered) but each represents a class of regression that goes undetected without coverage.

A separate Phase 2.5 commit ("Cancel discards just-added stub via explicit `justAdded` selection flag") covers the *Cancel-discards-stub* path. This task covers the four other sad paths.

## Scope — four sad-path tests

### 1. Cancel preserves original values across re-edit

After a user clicks Edit on an existing entry, types changes, then clicks Cancel: re-clicking Edit should show the original (pre-edit) values, not the cancelled draft. Verifies `startEditing` correctly resets `draft` from the live entity rather than reusing stale local state.

Likely fixture: existing rule with `label: 'Original'`. User clicks Edit, types `'Cancelled'`, clicks Cancel, clicks Edit again. Assert input value is `'Original'`.

Applies to all three inspectors (MatchRule, SearchVector, AwarenessQuestion). One test per inspector, or one parameterized test.

### 2. Blank-save behavior

The inspectors call `.trim()` on text fields but do not reject empty values. A user can save a rule with `label: ''`, `description: ''` — the entry sticks around as "Untitled rule" forever.

**Decision needed before writing the test:** is this intentional (defer validation to user judgment) or accidental? Two paths:
- (a) Test asserts current behavior: blank save persists, with an inline comment explaining why (no validation by design).
- (b) Add inspector-side validation that disables Save when the required field is empty; test asserts the disabled state.

Recommended: (b). The current behavior was likely not a deliberate decision; "Save" should require something save-worthy.

Required fields per inspector:
- MatchRuleInspector: `label`
- SearchVectorInspector: `title` (and probably `thesis`)
- AwarenessQuestionInspector: `topic` (and probably `action`)

### 3. Rapid selection switching drops unsaved drafts

User clicks a vector, enters edit mode, types changes, then clicks a different vector in the band before saving. Expected: original vector unchanged, new vector's inspector renders with fresh local state (the dispatcher's `key` prop should make this work via remount).

Test fixture: two existing rules. User clicks rule 1, clicks Edit, types in label field, clicks rule 2. Assert: rule 1's label is unchanged in the store; rule 2's inspector shows rule 2's label in read mode.

### 4. Awareness severity unset

`AwarenessQuestionInspector` has a `'— unset'` option in its severity select that maps to value `''`. Saving with that option should clear `question.severity` to undefined (the `severity ? { severity } : { severity: undefined }` branch in handleSave).

Test fixture: existing question with `severity: 'high'`. User clicks Edit, changes severity select to `'— unset'`, clicks Save. Assert: `question.severity === undefined`.

## Out of scope

- Cancel-discards-just-added-stub — covered by Phase 2.5 commit (separate from this task).
- New canonical-edit features. This task is purely test-coverage.
- Refactoring the inspector pattern (extracting shared stub helpers, etc.). Code-quality concern; separate task if pursued.

## Reference commits

- TASK-195 implementation: commits `a8c77ea` through `efcbf68`.
- TASK-195 ACs and outcomes: see `backlog/tasks/task-195 - ...md`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Test verifies Cancel-then-Edit shows original values (not cancelled draft) for all three inspectors (MatchRule, SearchVector, AwarenessQuestion)
- [x] #2 Decision recorded: blank-save is either tested as intentional behavior OR inspectors gain validation that disables Save when required fields are empty (recommendation: add validation)
- [x] #3 If validation added: inspectors disable Save button when required field is empty; test asserts disabled state for each inspector
- [x] #4 Test verifies rapid selection switching: switching between two rules of the same kind drops the unsaved draft and renders fresh local state for the new selection
- [x] #5 Test verifies awareness severity '— unset' option clears severity to undefined on save
- [x] #6 All new tests live in src/test/IdentityMapEditing.test.tsx (or a sibling file if the new tests grow it past ~400 lines)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation plan:
- Inspect the existing Identity Map editing test harness and the three inspector slot save/cancel behaviors.
- Add focused sad-path coverage for cancel/re-edit, blank-save validation, rapid selection switching, and awareness severity clearing.
- If blank-save validation is absent, add minimal inspector-side Save disablement for the required fields only.
- Run focused Vitest, scoped lint, typecheck/build as practical, then close TASK-200 with evidence.

2026-05-08 closeout:
- Added 16 additional Identity Map editing tests in `src/test/IdentityMapEditing.test.tsx`, including the four required sad paths plus parity coverage for avoid-rule save, search-vector/awareness selection-switch draft drops, and justAdded save/cancel lifecycle for match rules and awareness questions.
- Added required-field Save disabling for match rule label, search vector title/thesis, and awareness question topic/action.
- Added accessible field error descriptions with per-instance ids from `useId`, keeping validation hints outside the label text.
- Verification passed: `npx vitest run src/test/IdentityMapEditing.test.tsx` (24 passed), scoped ESLint on touched TS/TSX files, scoped format check, `npm run typecheck`, and `npm run build` (existing Vite large-chunk warnings).
- Independent source review artifacts: `.agents/reviews/review-20260508-170951.md` and `.agents/reviews/review-20260508-171750.md` blocked on accessibility issues that were fixed; `.agents/reviews/review-20260508-172019.md` reported one P1 about required-field trimming, verified as a false positive because `topic`, `action`, `title`, and `thesis` are all trimmed on save.
- Independent test audit `.agents/reviews/test-audit-20260508-171750.md` confirmed TASK-200's required behaviors are covered and surfaced broader follow-up gaps for parser/list boundary cases, discard parity, and optional-field edges; those are outside this task's scoped ACs.
- Full `npm run test` was not rerun for this closure because unrelated repo-wide failures were already documented in adjacent doc-40 lanes and treated as non-gating.
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
