---
id: TASK-208.1
title: Retire direct Match-to-Prep generation behind Pipeline promotion
status: Done
assignee:
  - '@codex'
created_date: '2026-05-05 16:22'
updated_date: '2026-05-05 15:21'
labels:
  - refactor
  - prep
  - canonical-projections
dependencies: []
references:
  - src/routes/prep/PrepPage.tsx
  - src/store/matchStore.ts
documentation:
  - docs/architecture/facet-workspace-topology.md
parent_task_id: TASK-208
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Lock decision: job-specific Prep generation must launch from Pipeline-owned application context. Direct Match-to-Prep generation creates Prep decks without a durable pipeline entry, which conflicts with the topology now used by Build and Letters.

Scope this to removing or disabling the direct Match source path in Prep, replacing it with a promote/create Pipeline entry affordance, and preserving non-job-specific blank/manual deck flows.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Prep no longer creates AI-generated job-specific decks from Match state without a pipeline entry.
- [x] #2 When Match context exists, Prep surfaces a promote/create Pipeline entry path instead of Generate with AI.
- [x] #3 Manual/blank Prep deck creation remains available and does not require a pipeline entry.
- [x] #4 Tests cover the retired Match generation path and the Pipeline-required helper state.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Starting follow-up retirement slice after TASK-208.3 commit 44ca083. Plan: remove the direct Match-backed AI generation path from Prep, surface Pipeline promotion/opening copy/action when Match context exists, keep manual/blank deck creation intact, and add regression tests for no Match-only AI generation.

Completed in this slice:
- Removed the Match-backed AI generation branch and the orphan matchMaterial helper.
- Generate with AI now requires a selected Pipeline entry; Match reports surface an Open Match promotion path instead.
- Manual blank prep creation remains available without a Pipeline entry.
- Regeneration of standalone or missing-link decks now hard-fails with a Pipeline relink recovery path.
- Relinking names the exact selected Pipeline entry, refreshes the deck title and canonical JDAnalysis anchors, and preserves existing deck URL when the Pipeline entry has no URL.

Verification:
- `pnpm vitest run src/test/PrepPage.test.tsx src/test/PrepPage.identityGeneration.test.tsx` — 2 files, 29 tests passed.
- `pnpm typecheck` — passed.
- `pnpm exec eslint src/routes/prep/PrepPage.tsx src/test/PrepPage.test.tsx src/test/PrepPage.identityGeneration.test.tsx` — passed.
- `pnpm build` — passed with the existing large-chunk warnings.
- Source review: `.agents/reviews/review-20260505-151737.md` still reports a stale-import P1 for `getJdAnalysisDriftStatus`, but that is a false positive: the helper is used by `resolvePrepGenerationContext`, and both typecheck and lint pass. The real title-refresh P1 from that review was fixed and covered by test.
- Test audit: `.agents/reviews/test-audit-20260505-150556.md` confirmed the retirement-specific coverage; broader PrepPage gaps remain out of scope for this task and some are covered in the companion canonical-JDAnalysis test file.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
