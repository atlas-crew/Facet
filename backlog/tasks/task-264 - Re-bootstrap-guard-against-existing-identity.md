---
id: TASK-264
title: Re-bootstrap guard against existing identity
status: To Do
assignee: []
created_date: '2026-05-11 05:20'
updated_date: '2026-05-11 05:21'
labels:
  - feature
  - identity
  - multi-source-intake
milestone: m-33
dependencies:
  - TASK-260
modified_files:
  - src/routes/identity/IdentityPage.tsx
  - src/routes/identity/ExtractionAgentCard.tsx
  - src/test/IdentityPage.test.tsx
priority: medium
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Guard the synthesis trigger so that when the user already has a populated identity, running multi-source intake again requires explicit confirmation that the operation REPLACES the current identity. Bootstrap (empty identity) flows unchanged.

CONTEXT (load-bearing decisions from m-33 milestone):
- Multi-source intake is BOOTSTRAP-ONLY for v1. Re-runs are real ("I have new resumes since I first set this up") but they're a Phase 2 surface, not the v1 problem.
- The existing single-file `mergeProfessionalIdentity` path (incremental enrichment) is unaffected. This guard only protects the new multi-source synthesis trigger.
- Per-bullet deepen, manual edits, and all other identity actions are NOT affected.

GUARD SHAPE:
- On Generate Draft trigger from the multi-source bay, check `currentIdentity` non-emptiness (roles array non-empty, or profiles non-empty, or skills.groups non-empty — pick the canonical "populated" signal).
- If empty: proceed silently (bootstrap case).
- If populated: show a confirm dialog with explicit language ("Generating from these sources will replace your current identity. Continue?"), Cancel default.
- On Cancel: return to the bay; no API call.
- On Confirm: proceed with synthesis.

REFERENCES:
- Trigger location: src/routes/identity/IdentityPage.tsx (Generate Draft handler)
- ExtractionAgentCard.tsx wires the button
- Existing currentIdentity slot: src/store/identityStore.ts
- Existing confirm dialog patterns in the repo (if any) for visual consistency — search for `confirm` or `dialog` components
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Synthesis trigger checks currentIdentity non-emptiness using a clearly-named selector (e.g., hasPopulatedIdentity)
- [ ] #2 Empty identity case: trigger proceeds silently to synthesis (bootstrap path)
- [ ] #3 Populated identity case: confirm dialog appears with explicit 'replace your current identity' language; Cancel is the default focused action
- [ ] #4 Cancel returns to the bay without calling generateIdentityDraft; no draft modification
- [ ] #5 Confirm proceeds to synthesis as normal
- [ ] #6 Per-bullet deepen, identity edits, draft application, and other identity flows are NOT gated by this guard
- [ ] #7 Test: confirm-replace continues to generation; cancel exits without API call
- [ ] #8 Test: empty identity bypasses the dialog entirely
- [ ] #9 Test: guard does not trigger for the per-bullet deepen flow
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
