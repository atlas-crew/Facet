---
id: TASK-293
title: 'Surface downstream sections when regenerating, with selective regenerate'
status: Done
assignee:
  - '@codex'
created_date: '2026-06-07 20:28'
updated_date: '2026-06-08 02:56'
labels:
  - identity
  - ai
  - ux
milestone: m-35
dependencies: []
priority: high
ordinal: 49000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The identity model has a clear generation dependency chain (bullets → skills → thesis → profiles → chapters → self-knowledge → positioning → search — see the order text already shown in IdentityMapPage around lines 1027-1030). When a user regenerates an upstream section, downstream sections derived from it become stale, but today nothing communicates this.

Make the downstream relationships visible and actionable: when a user regenerates a section, show which sections are downstream of it and offer to regenerate some or all of them. This is the "evidence vs narrative" and inference-UX concern — users should understand what their regeneration invalidates.

Scope to design + implement:
- Encode the section dependency graph in one place (a derived map, not duplicated per-band).
- On a regenerate action, present the affected downstream sections (e.g. a confirercmation/selection step) and let the user choose which to regenerate.
- Mark/indicate downstream sections as potentially stale after an upstream regenerate even if the user defers.

This is a substantial UX feature; treat the dependency-graph module and the regenerate-with-downstream flow as the core deliverables. Coordinate with the run-all inference work (TASK-268.3) which already sequences these generators.

Relevant files: src/routes/identity/IdentityMapPage.tsx, src/routes/identity/identityInferenceRuntime.ts, src/routes/identity/useInferenceRequest.ts, the bands/ generators.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The section dependency graph (bullets→skills→thesis→profiles→chapters→self-knowledge→positioning→search) is encoded in a single reusable module
- [x] #2 Triggering a regenerate on a section surfaces which sections are downstream of it
- [x] #3 The user can choose to regenerate some or all downstream sections, or defer
- [x] #4 Deferred downstream sections are visibly indicated as potentially stale after an upstream regenerate
- [x] #5 The flow reuses the existing inference runtime/sequencing rather than duplicating generator calls
- [x] #6 Unit test covers the dependency-graph resolution (given section X, correct downstream set)
- [x] #7 Interaction is documented in the relevant identity domain-model doc section
<!-- AC:END -->



## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented downstream regeneration UX: reusable inference dependency graph, action-list downstream prompt, selective/deferred regeneration, stale markers, request-settled cascade sequencing through existing band request-id handlers, draft-review guardrails for thesis/positioning, and focused regression coverage. Verification: npm run test -- src/test/IdentityMapEditing.test.tsx; npm run test -- src/test/identityInferenceDependencies.test.ts; npm run typecheck; npx eslint touched TS/TSX files; git diff --check. Independent source review completed with no P0/P1 remaining; diff test audit rerun with jumbo fallback and P1 gaps covered by added tests.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added Identity Map downstream regeneration controls and stale-state recovery for M-35. The dependency graph now lives in a reusable module, action-list regenerations surface downstream impact, deferred sections remain visible as stale, and selected/stale regeneration is sequenced via existing request-id band handlers rather than direct generator calls. Draft-producing sections require review before downstream regeneration. Added graph/unit and route regression coverage plus domain-model documentation.
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
