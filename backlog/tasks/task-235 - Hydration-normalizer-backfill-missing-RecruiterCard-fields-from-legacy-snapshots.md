---
id: TASK-235
title: >-
  Hydration normalizer: backfill missing RecruiterCard fields from legacy
  snapshots
status: To Do
assignee: []
created_date: '2026-05-06 20:28'
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
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
