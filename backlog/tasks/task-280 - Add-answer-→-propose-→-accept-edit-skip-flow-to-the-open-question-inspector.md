---
id: TASK-280
title: Add answer → propose → accept/edit/skip flow to the open-question inspector
status: Done
assignee: []
created_date: '2026-06-05 17:15'
updated_date: '2026-06-07 04:52'
labels: []
milestone: m-34
dependencies:
  - TASK-278
  - TASK-279
references:
  - src/routes/identity/inspectorSlots/AwarenessQuestionInspector.tsx
  - 'src/routes/identity/IdentityInspector.tsx:125'
  - 'src/types/artifactMeta.ts:329'
documentation:
  - >-
    specs/answerable-identity-open-questions/doc-45 -
    Answerable-Identity-Open-Questions-—-Design.md
modified_files:
  - src/routes/identity/inspectorSlots/AwarenessQuestionInspector.tsx
  - src/routes/identity/identityMap.css
  - src/test/AwarenessQuestionInspectorAnswerFlow.test.tsx
priority: medium
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Presentation layer that closes the loop the user actually sees: answer an open question on the Identity Map, review the AI-proposed identity patch, and accept / edit / skip it.

WHY: This is the user-visible fix for the reported gap — open questions display with no way to answer them. Tasks 278 (generator + AnswerPatch + schema fields) and 279 (apply + resolve store actions) supply everything this task wires together; the pending proposal is held in EPHEMERAL inspector state (not persisted), reusing the proposed-vectors interaction shape but not its draft storage (see doc-45).

Key file: src/routes/identity/inspectorSlots/AwarenessQuestionInspector.tsx (currently only Edit / Mark-reviewed / Remove). Dispatch already routes awareness-question selections via src/routes/identity/IdentityInspector.tsx. After apply, optionally surface describeImpact (src/types/artifactMeta.ts:329) so the user sees downstream artifacts that may need refresh. Follow the UI design system (route-scoped CSS, design tokens, 4px grid) and keep the answer flow keyboard- and screen-reader-accessible.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The inspector shows an answer textarea and a Propose update action for an unresolved question
- [x] #2 Submitting an answer calls proposeAnswerPatch and shows a working/loading state while the proposal is generated
- [x] #3 The returned proposal renders as a human-readable card describing the target (e.g. 'Add bullet to <role>') with Accept, Edit, and Skip controls
- [x] #4 Accept applies the patch via the store action and marks the question resolved; the question then renders in a resolved state showing the recorded answer
- [x] #5 Edit lets the user adjust the proposed text before accepting; Skip discards the proposal without mutating the identity and leaves the question unresolved
- [x] #6 A generator/proxy error is surfaced inline without losing the user's typed answer
- [x] #7 After a successful apply, downstream impact is surfaced (describeImpact) or an explicit decision to omit it is documented
- [x] #8 The flow is keyboard-accessible and labeled for screen readers; styling uses existing design tokens and route-scoped CSS
- [x] #9 Tests cover the happy path (answer→propose→accept→resolved), the skip path, the error path, and resolved-state rendering
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan (grounded in current code)

Prerequisites: TASK-278 (proposeAnswerPatch + AnswerPatch) and TASK-279 (applyAnswerPatch + resolveAwarenessQuestion store actions) must land first.

### Target file
src/routes/identity/inspectorSlots/AwarenessQuestionInspector.tsx (full current contents reviewed: it has an `editing` view and a read view; store hooks via useIdentityStore; actions today = Edit / Mark-reviewed / Remove). Dispatch already routes here from IdentityInspector.tsx:125. No change needed to the dispatcher.

### Patterns to copy (do not invent new UX)
- Endpoint + config error: `ensureIdentityInferenceEndpoint('Connect the AI proxy before answering questions.')` from src/routes/identity/identityInferenceRuntime.ts. It throws `IdentityInferenceConfigError`. Mirror the band catch (SearchStrategyBand.tsx:316-329): if `error instanceof IdentityInferenceConfigError` show its message; else console.error + show a generic "Couldn't propose an update — try again." Keep the user's typed answer in state on error.
- Working indicator: reuse `<AiWorkingStatus active=… label=… caption=… />` and the status-message component already used in the bands, or a minimal local busy state — keep it lightweight for a slot.
- Store access: `const proposeViaStore` is NOT a thing — call the generator `proposeAnswerPatch` (from src/utils/identityParametersGeneration) directly with (currentIdentity, question, answer, endpoint), exactly as bands call generators.

### State (local useState in the inspector)
- `answer: string` (textarea value)
- `phase: 'idle' | 'proposing' | 'review'`
- `proposal: AnswerPatch | null`
- `error: string | null`
The proposal is EPHEMERAL — held only here, never persisted (per doc-45; this is the key divergence from the proposed-vectors draft storage).

### Flow
1. For an UNRESOLVED question (read view), render an "Answer" `<textarea>` + a "Propose update" button (disabled while proposing or when answer is blank).
2. On submit: set phase='proposing'; `try { endpoint = ensureIdentityInferenceEndpoint(...); patch = await proposeAnswerPatch(identity, question, answer, endpoint); setProposal(patch); phase='review' } catch (e) { set error per band pattern; phase='idle' }` — keep `answer` intact.
3. Review card: render a human-readable description of `proposal` keyed on kind:
   - role-bullet → "Add a bullet to <role title for proposal.roleId>" + show problem/action/outcome (and metrics/tech if present).
   - skill → "Add skill ‘<skillName>’ to <group label>".
   - self-model-arc → "Add arc chapter at <company>".
   - competitive-moat → "Set competitive moat".
   - unfair-advantage → "Add unfair advantage(s)".
   Resolve role/group labels from `identity.roles` / `identity.skills.groups` for display.
   Controls: **Accept**, **Edit**, **Skip**.
4. Accept: `applyAnswerPatch(proposal)` then `resolveAwarenessQuestion(question.id, answer)`; clear local proposal; the question now renders resolved.
5. Edit: allow editing the proposal's free-text before accepting. Minimal scope — for role-bullet edit problem/action/outcome text; for text/items kinds edit the string(s). Mirror the constrained-patch philosophy of ProposedSearchVectorPatch (don't build a full form).
6. Skip: discard proposal (setProposal(null), phase='idle'); identity unchanged; question stays unresolved with the typed answer optionally retained.

### Resolved-state rendering
When `question.resolved`, the read view shows a resolved badge + the recorded `question.answer` (read-only), and hides the answer textarea / propose button (offer a subtle "answer again" affordance only if cheap). Keep Edit-question / Remove available.

### describeImpact (AC#7) — scoped sub-decision, FLAG BEFORE BUILDING
describeImpact (src/types/artifactMeta.ts:329) needs a full IdentityMutation `{ label, fields[], fromRevision, toRevision, valueChanges? }` PLUS an `impactArtifacts: ImpactArtifactInput[]` collection. ResearchPage assembles that inline and skill-depth-specific (ResearchPage.tsx:858-877) — there is no generic reusable collector today. Options:
  (a) Minimal: after apply, map patch.kind → affected fields (role-bullet→['roles'], skill→['skills'], self-model-*→['self_model']) and from/to identity revision, collect impactArtifacts via the same workspace selectors ResearchPage uses, show the existing impact banner.
  (b) Omit for v1 and file a follow-up (AC#7 explicitly allows documenting omission).
RECOMMENDATION: (b) for this task unless the impact collector can be factored out cheaply; if (a), extract a small `collectIdentityImpactArtifacts(workspace)` helper rather than duplicating ResearchPage logic. Confirm choice with reviewer before implementing.

### Accessibility & styling
- Textarea labeled; buttons have accessible names; busy state via aria-busy like the bands.
- Route-scoped CSS + existing design tokens / 4px grid (UI design system). Reuse inspector slot classes (inspector-field, inspector-btn, Actions, SlotShell) already in this file.

### Tests
Extend/add an inspector test (co-locate in src/test/; see existing inspector/IdentityMap tests for render+store setup). Mock proposeAnswerPatch. Cover:
- happy path: type answer → propose → review card shows → accept → applyAnswerPatch + resolveAwarenessQuestion called → resolved rendering.
- skip path: proposal discarded, no store mutation, question still unresolved.
- error path: proposeAnswerPatch rejects → error shown, typed answer preserved, no mutation.
- resolved-state rendering shows the recorded answer and hides the propose affordance.

### Files touched
- src/routes/identity/inspectorSlots/AwarenessQuestionInspector.tsx
- src/routes/identity/<feature>.css (answer/proposal card styles, if needed)
- src/test/<AwarenessQuestionInspector or IdentityMap answer-flow>.test.tsx (new/extended)

### Verification
- `npm run typecheck && npx vitest run <test file>`
- `npm run build` (UI/render wiring changed — required for this task).
- Manual: `npm run dev` → Identity Map → select an open question → answer → propose → accept → confirm the model field updated and the question shows resolved.

### Scope boundary
Presentation only. Consume 278/279 exports; do not modify the generator or store beyond wiring. If new store/generator capability is needed, STOP and raise a scope-change per the execution guide rather than expanding silently.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Implementation

Added the full answer → propose → accept/edit/skip flow to `AwarenessQuestionInspector.tsx`.

### New state (ephemeral, per doc-45)
- `answer: string` — textarea value for the user's response to the question
- `answerPhase: 'idle' | 'proposing' | 'review' | 'editing'` — AI answer flow phase
- `proposal: AnswerPatch | null` — AI-proposed patch (never persisted)
- `answerError: string | null` — inline error message
- `editDraft: ProposalEditDraft | null` — editable slice of proposal during edit phase

### New sub-components (file-scoped)
- `ProposalCard` — renders a human-readable description of the AnswerPatch (keyed on `kind`), with Accept / Edit / Skip actions
- `ProposalEditForm` — controlled edit form for the editable fields of each patch kind (role-bullet: problem/action/outcome; skill: skillName; self-model-arc: chapter; competitive-moat: text; unfair-advantage: items textarea)

### Error handling
Mirrors `SearchStrategyBand`: `IdentityInferenceConfigError` messages surface verbatim; other errors show "Couldn't propose an update — try again." Both preserve the typed answer in state.

### Resolved state
When `question.resolved`, the read view shows a `inspector-resolved-badge` ("Resolved") and the recorded `question.answer` (read-only). Hides the answer textarea and Propose button. Edit question / Remove remain available.

### describeImpact (AC#7)
Omitted in v1. No generic `collectIdentityImpactArtifacts` helper exists today; `ResearchPage` assembles impact inline with skill-depth-specific context that can't be reused here without extraction. A follow-up task should factor this out before wiring it to the answer-flow accept path.

### CSS additions (identityMap.css)
Added `.inspector-answer-section`, `.inspector-resolved-section`, `.inspector-resolved-badge`, `.inspector-resolved-answer`, `.inspector-resolved-answer-text`, `.inspector-proposal-card`, `.inspector-proposal-header`, `.inspector-proposal-kind`, `.inspector-proposal-items`.

### Tests (17 tests, all green)
- Unresolved state: textarea visible, propose button disabled when empty, enabled when text entered
- Happy path: propose → review card renders → accept → store updated (resolved + bullet appended) → resolved badge in UI
- Loading state: button shows "Proposing…" while in-flight
- Skip: proposal discarded, store unchanged, answer text retained
- Error (generic): error alert shown, typed answer preserved, no store mutation
- Error (config): IdentityInferenceConfigError message shown verbatim
- Edit flow: opens edit form with pre-filled fields → back returns to review → accept with edited text applies edited patch
- Resolved rendering: badge + answer shown, propose button hidden, Edit question + Remove still present
- Resolved with no answer: badge shown, no answer field rendered
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
