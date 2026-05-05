---
id: TASK-208.3
title: Pass canonical JDAnalysis projection into pure Prep generation
status: Done
assignee:
  - '@codex'
created_date: '2026-05-05 16:23'
updated_date: '2026-05-05 18:31'
labels:
  - refactor
  - prep
  - canonical-projections
dependencies:
  - TASK-208.1
  - TASK-208.2
references:
  - src/routes/prep/PrepPage.tsx
  - src/utils/prepGenerator.ts
  - src/utils/jdAnalysis.ts
  - src/store/jdAnalysisStore.ts
  - src/routes/letters/LettersPage.tsx
documentation:
  - docs/architecture/facet-workspace-topology.md
  - docs/development/refactors/2026-04-jd-analysis-consolidation.md
parent_task_id: TASK-208
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Lock decision: keep prepGenerator pure. Store resolution belongs in PrepPage or a small generation-context helper; prepGenerator receives structured JDAnalysis input and no longer re-infers analysis from raw JD text.

This is the main Workstream 2 implementation slice: resolve PipelineEntry + JDAnalysis + drift, block missing/stale analysis, pass canonical analysis into the generator, and update prompts/tests so stack alignment, gap framing, landmines, positioning, and watch-outs are projected from JDAnalysis instead of rediscovered from raw JD.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Prep generation resolves the linked Pipeline entry JDAnalysis and blocks generation when it is missing or stale.
- [x] #2 prepGenerator accepts structured JDAnalysis input and does not import Zustand stores.
- [x] #3 Prompt/input contract uses JDAnalysis fields for requirements, skill matches, strengths, gaps, watch-outs, positioning, and evidence mapping.
- [x] #4 Raw JD text is retained only as source/snapshot context, not as the analysis source for generation.
- [x] #5 Tests validate that Prep no longer re-infers JD analysis from raw JD text.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Audit notes: PrepPage has pipeline and legacy Match generation branches that both call prepGenerator with raw jobDescription today. Implementation plan for this loop: introduce a PrepPage generation-context helper that resolves PipelineEntry + JDAnalysis + drift from stores; update prepGenerator to accept canonical JDAnalysis projection and use it for requirements/skills/strengths/gaps/watch-outs/positioning while keeping raw JD only as source text; stamp PrepDecks with JDAnalysis metadata; keep legacy Match branch temporarily fed by matchStore.currentJDAnalysis until the follow-up retirement commit removes it; add guardrail tests for missing/stale analysis and no raw-JD analysis source.

Implementation complete: PrepPage resolves fresh canonical JDAnalysis for Pipeline-linked prep generation/regeneration, temporarily feeds legacy Match generation from currentJDAnalysis until the separate retirement commit, and hard-fails missing/stale JDAnalysis before invoking AI. prepGenerator now accepts structured JDAnalysis, projects the allowlisted canonical fields into the prompt, keeps raw JD text only as source text, and stamps generated decks with JDAnalysis anchors. Verification: pnpm vitest run src/test/prepGenerator.test.ts src/test/prepContractValidation.test.ts src/test/PrepPage.identityGeneration.test.tsx; pnpm typecheck; pnpm exec eslint touched files; pnpm build. Independent review: .agents/reviews/review-20260505-141139.md clean. Test audit: .agents/reviews/test-audit-20260505-142240.md covers PrepPage JDAnalysis flow; .agents/reviews/test-audit-20260505-142800.md confirms generator canonical JDAnalysis prompt coverage, with remaining gaps broad pre-existing generator coverage outside this slice.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Refactored Prep generation to consume canonical JDAnalysis from the page-level generation context. Pipeline-linked generation and regeneration now block missing or stale analysis, legacy Match generation temporarily uses currentJDAnalysis until the separate retirement commit, and generated decks preserve JDAnalysis anchor metadata. Added guardrail tests for canonical prompt projection, raw-JD non-reinference, Pipeline/Match stale blocks, and regeneration drift.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
