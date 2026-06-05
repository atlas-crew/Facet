---
id: TASK-280
title: Add answer → propose → accept/edit/skip flow to the open-question inspector
status: To Do
assignee: []
created_date: '2026-06-05 17:15'
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
- [ ] #1 The inspector shows an answer textarea and a Propose update action for an unresolved question
- [ ] #2 Submitting an answer calls proposeAnswerPatch and shows a working/loading state while the proposal is generated
- [ ] #3 The returned proposal renders as a human-readable card describing the target (e.g. 'Add bullet to <role>') with Accept, Edit, and Skip controls
- [ ] #4 Accept applies the patch via the store action and marks the question resolved; the question then renders in a resolved state showing the recorded answer
- [ ] #5 Edit lets the user adjust the proposed text before accepting; Skip discards the proposal without mutating the identity and leaves the question unresolved
- [ ] #6 A generator/proxy error is surfaced inline without losing the user's typed answer
- [ ] #7 After a successful apply, downstream impact is surfaced (describeImpact) or an explicit decision to omit it is documented
- [ ] #8 The flow is keyboard-accessible and labeled for screen readers; styling uses existing design tokens and route-scoped CSS
- [ ] #9 Tests cover the happy path (answer→propose→accept→resolved), the skip path, the error path, and resolved-state rendering
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Regression tests pass (scoped to touched files)
- [ ] #5 Linters report no warnings or errors in touched files
- [ ] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
