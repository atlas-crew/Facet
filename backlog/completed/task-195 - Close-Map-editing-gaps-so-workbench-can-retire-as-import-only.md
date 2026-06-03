---
id: TASK-195
title: Close Map editing gaps so workbench can retire as import-only
status: Done
assignee: []
created_date: '2026-04-29 08:15'
updated_date: '2026-05-08 23:15'
labels:
  - identity
  - map-convergence
  - phase-2
dependencies: []
references:
  - src/routes/identity/IdentityMapPage.tsx
  - src/routes/identity/IdentityInspector.tsx
  - src/routes/identity/inspectorSlots/MatchRuleInspector.tsx
  - src/routes/identity/inspectorSlots/SearchVectorInspector.tsx
  - src/routes/identity/inspectorSlots/AwarenessQuestionInspector.tsx
  - src/routes/identity/inspectorSlots/PrefFieldInspector.tsx
  - src/routes/identity/inspectorSlots/BulletInspector.tsx
  - src/routes/identity/bands/PreferencesBand.tsx
  - src/routes/identity/bands/SelfModelBand.tsx
  - 6afda50 — Phase 1 deletion commit
  - '05124ca — Phase 1 follow-up: removed dead inspector routes'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context

Phase 1 of the identity-workspace convergence (commit `6afda50`) deletes `IdentityStrategyWorkbench` from the workbench page. Phase 1 follow-up (commit `05124ca`) removed two now-dead inspector routes (`SearchVectorInspector`'s "Edit / Regenerate" and `AwarenessQuestionInspector`'s "Edit / Add evidence") that targeted the deleted strategy panel.

Phase 2 closes the remaining canonical-edit gaps so Map becomes the complete editing surface. The original audit identified six gaps; multi-perspective review narrowed required scope to three. The other three are deferred decisions with explicit user-signal triggers, not silent omissions.

The Map inspector pattern — band-level selection routing to a focused inspector slot — handles all three required gaps cleanly. Implementation order goes smallest-first to validate the inspector-extension pattern before scaling.

## Required scope (three gaps)

### Gap 1 — Match rule add / remove (smallest, do first)

`MatchRuleInspector` edits an existing rule's label/description/weight or severity, but cannot add or remove rules. The pre-deletion workbench had add/remove buttons inline next to each rule list (see `git show 6afda50:src/routes/identity/IdentityStrategyWorkbench.tsx` lines 978-1107).

Likely shape: add "Add prioritize rule" / "Add avoid rule" buttons to `PreferencesBand.tsx` (where match rules currently render as clickable list items selecting an inspector). Add a delete button inside `MatchRuleInspector`.

### Gap 2 — Search vector full-edit + add / remove

`SearchVectorInspector` only toggles `needs_review`. Phase 1 follow-up removed its dead "Edit / Regenerate" route, so the inspector is now read-only-with-toggle and there is no path to edit fields. Need to extend it to cover: `title`, `subtitle`, `priority`, `thesis`, `target_roles`, `keywords.primary`, `keywords.secondary`, `supporting_skills`, `evidence`. Plus add/remove from the parent — search vectors don't currently surface on any band, so this likely needs a new band entry (or fits inside an existing band — the simplest place is probably under `SelfModelBand`, but verify).

### Gap 3 — Awareness question full-edit + add / remove

Same shape as Gap 2. `AwarenessQuestionInspector` only toggles `needs_review`. Phase 1 follow-up removed its dead "Edit / Add evidence" route. Need to extend it to cover: `topic`, `severity`, `description`, `action`, `evidence`. Plus add/remove from a parent band — awareness questions don't currently surface on any band either.

## Deferred decisions (three gaps)

These were in the original audit but moved out of required scope after multi-perspective analysis. Each has an explicit user-signal trigger.

### Decision 1 — Accuracy rules (CRUD)

The pre-deletion workbench had a key/value table. Map has no representation today. **Trigger: build only if a downstream feature consumes `accuracy_rules` in user-facing flows.** Action before deciding: grep the codebase for `accuracy_rules` consumers. If unused, retire — the JSON import path remains the only entry until evidence shows users want it surfaced.

### Decision 2 — AI-generate vectors / awareness

Pre-deletion workbench had "Suggest Search Angles" and "Find Open Questions" buttons (LLM bulk-replace of canonical state). **Trigger: ship Phase 2 without it; observe how users actually populate vectors/awareness over 30 days; revisit.** UX constraint: bulk LLM-replace silently overwriting user work is a trust violation — if built, requires undo or confirmation step. Decision is product strategy (do we want bulk-generation as a primary flow, or intentional authoring?), not UX execution.

### Decision 3 — Autofill empty fields (bulk-fill prefs)

Pre-deletion workbench had a "Fill Empty Fields" button bulk-writing preferences from a template. Lowest user-evidence of the original six. **Trigger: don't build as a bulk button.** If empty-state coaching is needed, surface as inline empty-state hints inside `PrefFieldInspector` — same job at the right granularity. The bulk-button shape is rejected; whether to do anything at all is the open question.

## Out of scope

- The export-search-brief HTML download (`handleExportParameters` pre-deletion) — was a one-shot artifact, decide separately whether to bring forward to Map.
- Bullet metrics and source_text editing in `BulletInspector` — these are SCAN-STAGING fields, edited via `ScannedIdentityEditor` on the workbench. They live there intentionally because they're pre-apply scan output, not canonical state. Not a Phase 2 gap.
- `ProfileInspector`'s "Generate variant" button — pre-existing dead-end, predates Phase 1. Separate cleanup task.
- Rebuilding the workbench's tab navigation. Phase 1 deletes it; the workbench is single-mode (import) going forward.

## Reference commits

- Phase 1 deletion: `6afda50` (`feat(identity): retire IdentityStrategyWorkbench so Map is the canonical-edit surface`)
- Phase 1 follow-up: `05124ca` (`fix(identity): remove dead workbench routes from search-vector and awareness inspectors`)

When implementing, `git show 6afda50:src/routes/identity/IdentityStrategyWorkbench.tsx` recovers the deleted source for reference. `git show 6afda50:src/test/IdentityStrategyWorkbench.test.tsx` recovers the deleted tests — port relevant cases rather than writing fresh ones, to avoid losing covered behavior.

## Phase 2 implementation notes (2026-04-29)

### Test porting (AC #8)

The deleted `IdentityStrategyWorkbench.test.tsx` (recovered via `git show 6afda50^:src/test/IdentityStrategyWorkbench.test.tsx`) contained two tests:

1. `autofills empty strategy fields on first render` — covers the "Fill Empty Fields" bulk-fill, which is **Decision 3 (deferred / retired)**. Not relevant to port.
2. `shows richer guidance across the strategy tabs` — covers the deleted tab navigation and the "Fill Empty Fields" button, which are out of scope per task body. Not relevant to port.

Neither deleted test covered match-rule add/remove, search-vector edit, or awareness-question edit — those paths existed in the workbench's render code but were never test-covered. Fresh coverage was added in `src/test/IdentityMapEditing.test.tsx` against the new Map inspector + band surfaces (8 tests passing). The fill-strength util got coverage in `src/test/identityFillStrength.test.ts`.

### Deferred decision outcomes (AC #9)

#### Decision 1 — Accuracy rules CRUD: **Defer**

`generator_rules.accuracy` is consumed by three places (`src/identity/schema.ts:1112-1121`, `src/utils/searchProfileInference.ts:291`, `src/utils/identityParametersGeneration.ts:144,190`). All three are **LLM prompt instructions** — the field is interpolated into a system prompt, not surfaced to the user. There is no user-facing flow that displays, asks for, or otherwise consumes accuracy rules. Without an editor surface, users effectively run with empty rules unless they hand-craft JSON.

Building a CRUD surface adds editor weight before there is a user-pull. Defer until a concrete request lands or a UI feature visibly reads the field.

#### Decision 2 — AI-generate vectors / awareness: **Defer**

Phase 2 makes manual authoring of vectors and questions first-class via the Map. Per the task: ship Phase 2 without bulk LLM-generate and observe how users populate these over 30 days. The trust-violation risk of silent bulk-overwrite is real; if revisited later, must include undo or confirmation. The JSON import path remains the workaround for users who want to seed at scale during the observation window.

#### Decision 3 — Autofill empty fields (bulk-fill prefs): **Retire bulk-button shape**

Per the task body, the bulk-button is rejected — "don't build as a bulk button". Whether to add inline empty-state coaching inside `PrefFieldInspector` remains open. `PrefFieldInspector` already renders an `<em>Not set</em>` fallback for empty values; richer hints (placeholder examples, suggested options) are a possible future enhancement, but not required for Phase 2.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 MatchRuleInspector supports remove (delete button inside inspector)
- [x] #2 PreferencesBand supports add for both prioritize and avoid kinds
- [x] #3 SearchVectorInspector edits title, subtitle, priority, thesis, target_roles, keywords.primary, keywords.secondary, supporting_skills, evidence (in addition to needs_review toggle)
- [x] #4 Search vectors surface on a Map band with add and remove affordances
- [x] #5 AwarenessQuestionInspector edits topic, severity, description, action, evidence (in addition to needs_review)
- [x] #6 Awareness questions surface on a Map band with add and remove affordances
- [x] #7 Workbench (/identity/workbench) contains only import-pipeline UI (PDF scan, paste-text, generate draft, apply); no canonical-edit writers remain
- [x] #8 Tests cover each new add/remove/full-edit path; relevant behavior from deleted IdentityStrategyWorkbench.test.tsx is ported (recoverable via `git show 6afda50:src/test/IdentityStrategyWorkbench.test.tsx`), not rewritten from scratch
- [x] #9 Three deferred decisions (accuracy rules, AI-generate, autofill) have explicit recorded outcomes — build, defer, or retire — with reasoning, written into this task's notes before status flips to Done
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Phase 2 implementation notes — final outcomes

This section is the authoritative record for AC #8 and AC #9. A duplicate decision-recording section appears in the task description under "Phase 2 implementation notes (2026-04-29)" — the analyses agree on Decisions #2 and #3, but a follow-up verification on 2026-04-30 corrected an error in this section's earlier draft for Decision #1 (initially recorded as Retire; the correct outcome is Defer, matching the description's analysis).

### Decision #1 — Accuracy rules (CRUD): DEFER

**Trigger from task description:** "build only if a downstream feature consumes `accuracy_rules` in user-facing flows"

**Evidence (correct field name is `generator_rules.accuracy`, not `accuracy_rules`):**
- `src/utils/searchProfileInference.ts:291` — interpolated into LLM system prompt: "Any factual correction constraints in generator_rules.accuracy are authoritative and must be respected."
- `src/utils/identityParametersGeneration.ts:144` (search-vector generator) — "Respect generator_rules.accuracy as hard truth constraints."
- `src/utils/identityParametersGeneration.ts:190` (awareness-question generator) — same prompt instruction.

The field IS consumed downstream, but only as input to LLM prompts — not displayed to users, not edited through any UI flow. The user-facing impact of accuracy rules is indirect (better LLM output when set). Without an editor surface, the field is empty for anyone who doesn't hand-craft JSON.

**Outcome:** Defer. Building a CRUD surface adds editor weight before there is user-pull. Reopen this decision if a UI feature visibly reads accuracy rules, or if user feedback indicates the LLM behavior with empty rules is materially worse.

### Decision #2 — AI-generate vectors / awareness: DEFER

**Trigger from task description:** "ship Phase 2 without it; observe how users actually populate vectors/awareness over 30 days; revisit"

**Evidence:** `generateSearchVectorsFromIdentity` survives in `src/utils/identityParametersGeneration.ts:139` with tests in `src/test/identityParametersGeneration.test.ts`. The function is preserved; no Map UI surface was added.

**Outcome:** Defer. The function is intact; users can manually author vectors and questions through the new Phase 2 inspectors. Revisit after 30 days. UX constraint to remember when revisiting: bulk LLM-replace silently overwriting user work is a trust violation — if built, requires undo or confirmation step.

### Decision #3 — Autofill empty fields: RETIRE bulk-button shape; REFRAME as runtime normalizer

**Trigger from task description:** "don't build as a bulk button. If empty-state coaching is needed, surface as inline empty-state hints inside `PrefFieldInspector`"

**Evidence:**
- The bulk-fill button was deleted in Phase 1 (with `IdentityStrategyWorkbench`).
- `src/test/strategyEditorAutofill.test.ts` was deleted in Phase 2 work.
- Replacement: `normalizeAutofilledInterviewProcess` in `src/identity/schema.ts:362-392`, called from runtime identity normalization. Tests in `src/test/identityAutofillNormalizer.test.ts` (4 cases: strips placeholder prefixes from `strong_fit_signals` and `red_flags`, leaves authentic values unchanged, handles identities without `interview_process`).

**Outcome:** Bulk-button retired as planned. Twist on the original trigger: autofill *artifacts* may still exist in stored identities (legacy data, LLM-generated content), so rather than just retiring, autofill was reframed as **runtime cleanup** — placeholder prefixes get stripped on read instead of being prevented on write. Inline empty-state coaching inside `PrefFieldInspector` was not added — `PrefFieldInspector` already renders an `<em>Not set</em>` fallback; richer hints (placeholder examples, suggested options) are a possible future enhancement, not required for Phase 2.

### AC #8 — test port from deleted IdentityStrategyWorkbench.test.tsx

The deleted file had 2 cases (recovered via `git show 6afda50^:src/test/IdentityStrategyWorkbench.test.tsx`):
1. `autofills empty strategy fields on first render` — tested the now-retired autofill-on-mount behavior (Decision #3).
2. `shows richer guidance across the strategy tabs` — tested the now-deleted multi-tab strategy UI.

Neither case is portable: case #1 covers retired behavior; case #2 covers removed UI. The new `src/test/IdentityMapEditing.test.tsx` adds 8 net-new cases covering all add/remove/full-edit paths required by ACs #1-6. The "ported, not rewritten" subclause of AC #8 is satisfied vacuously (no portable behavior); the "tests cover each new path" subclause is satisfied by the 8 new cases.

Also retired: `src/test/strategyEditorAutofill.test.ts` (2 cases on bulk-fill from identity-derived signals) — replaced in concept (not by port) by `src/test/identityAutofillNormalizer.test.ts` (4 cases on cleanup of autofill artifacts). Different shape, different feature.

### DoD #5 — Linter clean (deliberately unchecked)

Phase 2 changes added zero new lint issues. The project carries 683 pre-existing problems that predate this task. Either treated as scope-creep here or filed as a separate cleanup task. Not blocking AC sign-off.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Status flipped to Done on 2026-05-08 during backlog staleness audit. All 9 ACs are checked; only DoD #5 (linter clean) remains unticked because of 683 pre-existing repo-wide lint problems unrelated to this task — explicitly called out in implementation notes as scope-creep, not blocking. doc-40 v2 already references TASK-195 as Done in its history.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS — *Phase 2 changes added zero new lint issues; the project carries 683 pre-existing problems unrelated to this task. Either treat as scope creep here or open a separate cleanup task.*
- [x] #6 The project builds successfully
<!-- DOD:END -->
