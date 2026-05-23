---
id: TASK-264
title: Re-bootstrap guard against existing identity
status: In Progress
assignee: []
created_date: '2026-05-11 05:20'
updated_date: '2026-05-23 23:13'
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
- [x] #1 Synthesis trigger checks currentIdentity non-emptiness using a clearly-named selector (e.g., hasPopulatedIdentity)
- [x] #2 Empty identity case: trigger proceeds silently to synthesis (bootstrap path)
- [x] #3 Populated identity case: confirm dialog appears with explicit 'replace your current identity' language; Cancel is the default focused action
- [x] #4 Cancel returns to the bay without calling generateIdentityDraft; no draft modification
- [x] #5 Confirm proceeds to synthesis as normal
- [x] #6 Per-bullet deepen, identity edits, draft application, and other identity flows are NOT gated by this guard
- [x] #7 Test: confirm-replace continues to generation; cancel exits without API call
- [x] #8 Test: empty identity bypasses the dialog entirely
- [x] #9 Test: guard does not trigger for the per-bullet deepen flow
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the multi-source intake replacement guard in IdentityPage. Fresh upload/intake generation now checks a hasPopulatedIdentity predicate covering identity core fields, links, roles, projects, education, profiles, skill groups, and search vectors before allowing a generated draft to replace an existing identity. If populated, the Source Intake Generate Draft path opens an accessible confirmation dialog with Cancel as the safe first focus target, focus trapping via the shared useFocusTrap helper, Escape-to-cancel, and explicit focus return to the invoking button. Cancel and Escape do not call generateIdentityDraft; Continue proceeds to the existing runGenerate path. Regenerate, paste-mode generation, apply/merge, and per-bullet deepen remain outside the guard. Added regression coverage in IdentityPage.test.tsx for cancel, continue, Escape, focus trap/return, populated/empty/whitespace/link-only identity signals, regenerate and paste bypasses, header action behavior, and deepen bypass. Verification: npx vitest run src/test/IdentityPage.test.tsx (48 passed); npx eslint src/routes/identity/IdentityPage.tsx src/routes/identity/ExtractionAgentCard.tsx src/test/IdentityPage.test.tsx; npm run typecheck; npm run build (passes with existing Vite chunk-size warning); git diff --check. Independent review/audit artifacts were produced in .agents/reviews, with final audit reporting no P0/P1 gaps; final review still flagged contract/style concerns before the last simplification, which were addressed by making onGenerate fire-and-forget again and removing duplicate modal ownership.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a guarded replace-current-identity confirmation for fresh upload/intake draft generation, with focused tests and verification. Regenerate, paste generation, apply/merge, and bullet deepening are unaffected.
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
