---
id: TASK-211
title: Expose saved JD analysis from Pipeline entries
status: Done
assignee: []
created_date: '2026-05-04 04:01'
updated_date: '2026-05-04 22:42'
labels:
  - pipeline
  - jd-analysis
  - ux
dependencies: []
references:
  - src/routes/pipeline/PipelinePage.tsx
  - src/routes/pipeline/PipelineDetail.tsx
  - src/store/jdAnalysisStore.ts
  - src/utils/jdAnalysis.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pipeline entries that already have a saved job description analysis should clearly show that analysis exists and let users reopen the saved analysis from the Pipeline tracker without rerunning analysis or switching to Build first.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Pipeline tracker displays a visible indicator when an entry has a saved JD analysis.
- [x] #2 Users can open the saved JD analysis from the expanded Pipeline entry.
- [x] #3 The saved analysis view includes the core analysis details needed to review fit, summary, vectors, strengths, gaps, and warnings without rerunning analysis.
- [x] #4 Entries with stale or missing analysis show appropriate non-destructive messaging.
- [x] #5 Focused tests cover entries with saved, missing, and stale JD analysis states.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented Pipeline saved-JD-analysis indicators and disclosure: table badge states (not run, saved, stale, missing), expanded-row Show/Hide JD Analysis panel, stale/missing recovery messaging, and id-based analysis lookup. Verification: `npx vitest run src/test/PipelinePage.test.tsx src/test/PipelineJDAnalysisPanel.test.tsx src/test/pipelineAnalysis.test.ts` passed with 29 tests; targeted ESLint on touched Pipeline source/tests passed. `npm run typecheck` remains blocked by unrelated baseline errors in `src/routes/prep/PrepPage.tsx` (`createDeck`, `setActiveDeck`). Independent review artifact: `.agents/reviews/review-20260504-001440.md` (P0/P1 clean, P2 only). Test audit artifact: `.agents/reviews/test-audit-20260504-002505.md` (P0/P1 clean, P2 only; follow-up P2 coverage gaps were partially addressed with direct panel tests).

Post-Prep-blocker verification on 2026-05-04: pnpm typecheck passed; pnpm build passed with existing Vite large-chunk warnings only.
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
