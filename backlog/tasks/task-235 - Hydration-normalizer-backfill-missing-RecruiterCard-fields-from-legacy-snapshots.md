---
id: TASK-235
title: >-
  Hydration normalizer: backfill missing RecruiterCard fields from legacy
  snapshots
status: Done
assignee:
  - '@codex'
created_date: '2026-05-06 20:28'
updated_date: '2026-05-27 12:27'
labels:
  - audience-tagging
  - persistence
  - tech-debt
milestone: m-28
dependencies: []
references:
  - src/persistence/hydration.ts
  - src/utils/recruiterCardPdfRenderer.ts
  - src/types/recruiter.ts
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

Cards hydrated from a workspace snapshot taken before Phase 6 are missing `matchScoreMethodology` and `actionCta`. Currently the renderer compensates with defensive defaults (TASK in `recruiterCardPdfRenderer.ts`), but this is a runtime workaround for a hydration-layer concern.

A hydration normalizer would backfill missing fields once at load time, so downstream consumers (renderer, page, exports) can rely on the type contract without each having its own defensive defaults.

## What

- Add a `normalizeRecruiterCard` function in `src/persistence/hydration.ts` (or a new `recruiterCardNormalization.ts`) that:
  - Backfills `matchScoreMethodology: ''`, `actionCta: ''` when missing
  - Drops legacy fields (`positioningAngles`, `gapBridges`, `notes`) silently
- Wire it into the `applyWorkspaceSnapshotToStores` path so all hydrated cards are normalized
- Once normalizer is in place, renderer's defensive `str()`/`arr()` helpers can simplify or be removed
- Test: legacy-shape card → normalized to current shape with empty defaults

## Acceptance criteria

- normalizeRecruiterCard ships and is invoked on hydration
- A snapshot test with a legacy-shape card hydrates to the new shape
- Renderer can rely on the type contract (defensive defaults can be reduced)
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-05-27 Codex starting combined push with TASK-234/TASK-238. Plan: inspect recruiter card schema/store/snapshot hydration, add normalizer for legacy missing fields and dropped legacy keys, reduce renderer defensive defaults if safe, add legacy snapshot hydration coverage, then run gates/review/audit and close.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
2026-05-27 completed in commit 93101a1. Added recruiterCardNormalization and wired workspace hydration through normalizeRecruiterCards. Legacy cards now backfill matchScoreMethodology/actionCta, drop positioningAngles/gapBridges/notes, validate durable metadata, filter malformed card payloads, and preserve forward-compatible unknown fields. Renderer helpers were left in place as harmless defense for direct-render callers; hydrated store data now satisfies the current card contract. Verification: focused Vitest 174/174 pass, npm run typecheck, npm run lint, npm run build; recruiter hydration diff test audit reports no prioritized gaps.
<!-- SECTION:FINAL_SUMMARY:END -->
