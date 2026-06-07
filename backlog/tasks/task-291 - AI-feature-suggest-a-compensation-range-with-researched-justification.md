---
id: TASK-291
title: 'AI feature: suggest a compensation range with researched justification'
status: To Do
assignee: []
created_date: '2026-06-07 20:28'
labels:
  - identity
  - ai
  - preferences
milestone: m-35
dependencies: []
priority: medium
ordinal: 47000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add an AI action that proposes a compensation range for the candidate, doing light research on current market data and returning a range with justification. The identity model already has a compensation preferences object (preferences.compensation: base_floor, base_target, notes — see src/identity/schema.ts and src/types/identity.ts); this feature populates/suggests those values rather than adding new schema.

Inputs the model should use: the candidate's roles, seniority/areas of expertise, location preference, and target vectors. Output: a suggested floor and target with a short written justification the user can read and edit. The user remains in control — the suggestion is applied to the editable compensation fields, not silently committed.

Sonnet-tier may be sufficient. Follow the identity AI-action pattern (proxy guard, busy state, error handling) used by other generators. Respect the AI-inference-vs-user-input rule: present the range as a suggestion with its reasoning, never as authoritative fact.

Relevant files: src/routes/identity/inspectorSlots/PrefFieldInspector.tsx (compensation fields), src/routes/identity/bands/PreferencesBand.tsx, a new generator in src/utils/, src/store/identityStore.ts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An AI action on the compensation preferences proposes a base_floor and base_target
- [ ] #2 The proposal includes a short written justification referencing market data and the candidate's profile
- [ ] #3 The suggested values populate the editable compensation fields; the user can edit before keeping
- [ ] #4 The action uses the candidate's roles, seniority/expertise, and location/vector context as input
- [ ] #5 Action follows the identity AI-action UX pattern (proxy guard, busy/generating state, error handling)
- [ ] #6 Suggestion is framed as advisory (not authoritative) per the AI-inference-vs-user-input rule
- [ ] #7 Apply persists via immutable store update; unit test covers applying a suggested range to the store
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
