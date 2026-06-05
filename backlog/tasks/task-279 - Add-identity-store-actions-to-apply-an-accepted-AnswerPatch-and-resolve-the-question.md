---
id: TASK-279
title: >-
  Add identity store actions to apply an accepted AnswerPatch and resolve the
  question
status: To Do
assignee: []
created_date: '2026-06-05 17:14'
labels: []
milestone: m-34
dependencies:
  - TASK-278
references:
  - 'src/store/identityStore.ts:1587'
  - 'src/store/identityStore.ts:1509'
  - 'src/store/identityStore.ts:1682'
documentation:
  - >-
    specs/answerable-identity-open-questions/doc-45 -
    Answerable-Identity-Open-Questions-—-Design.md
priority: medium
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
State layer for the answerable-open-questions flow. Adds the store action that records a question's answer and resolution, and a patch-apply helper that routes an accepted AnswerPatch (from task 278) to the EXISTING identity write-back actions — no new write surfaces invented.

WHY: The inspector UI (task 3) needs a single, tested store entry point to (a) apply the user-accepted patch to the correct identity layer and (b) mark the question resolved. Keeping this in the store keeps the immutable-update discipline and write-back routing in one place.

Provided by task 278: the AnswerPatch discriminated union and the answer?/resolved? schema fields.

Routing (see doc-45): role-bullet → append via updateCurrentRoles; skill → addSkillToCurrentIdentity; self-model targets → updateCurrentSelfModelArc / updateCurrentCompetitiveMoat / updateCurrentUnfairAdvantages. All exist in src/store/identityStore.ts. resolveAwarenessQuestion(id, answer) sets answer + resolved:true via the existing updateCurrentAwarenessQuestions replace pattern (identityStore.ts:1587-1595). Updates must be immutable (spread/map), per repo store conventions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A store action resolveAwarenessQuestion(id, answer) sets answer and resolved:true on the matching question immutably, leaving other questions untouched
- [ ] #2 A patch-apply path takes an accepted AnswerPatch and dispatches to the correct existing write-back: role-bullet appends a bullet to the named role; skill adds via addSkillToCurrentIdentity; self-model kinds call the matching self-model action
- [ ] #3 Applying a role-bullet patch preserves all existing roles and bullets and only appends the new bullet to the targeted role
- [ ] #4 Applying a patch whose target id no longer exists is a safe no-op (or surfaces a recoverable error) rather than corrupting state
- [ ] #5 All mutations are immutable (no in-place mutation of store arrays/objects)
- [ ] #6 Tests cover each patch kind routing to the right write-back, the resolve action, and the missing-target safe path
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
