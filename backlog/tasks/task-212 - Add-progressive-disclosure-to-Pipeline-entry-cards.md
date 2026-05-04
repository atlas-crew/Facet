---
id: TASK-212
title: Add progressive disclosure to Pipeline entry cards
status: In Progress
assignee: []
created_date: '2026-05-04 07:05'
labels:
  - pipeline
  - ux
dependencies: []
references:
  - src/routes/pipeline/PipelineDetail.tsx
  - src/routes/pipeline/pipeline.css
  - src/test/PipelinePage.test.tsx
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Expanded Pipeline entries currently show dense nested cards and sections at once. Add in-entry collapse/expand controls so users can keep research, rounds, history, and other entry cards compact while preserving access to the full details.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Expandable Pipeline entry sections/cards have visible collapse/expand controls with accessible expanded state.
- [x] #2 Entry detail sections that can contain dense content, including research, rounds, and history, can be collapsed without losing their data.
- [x] #3 Default expanded/collapsed behavior preserves the most useful entry context while reducing visual clutter.
- [x] #4 Existing Pipeline entry workflows, including JD analysis disclosure and execution actions, continue to work.
- [x] #5 Focused tests cover collapsing and expanding the new Pipeline entry cards.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->

## Notes

- Focused verification passed: `npx vitest run src/test/PipelinePage.test.tsx src/test/PipelineJDAnalysisPanel.test.tsx src/test/pipelineAnalysis.test.ts src/test/pipelineStore.test.ts` (60 tests).
- Focused lint passed: `npx eslint src/routes/pipeline/PipelineDetail.tsx src/routes/pipeline/PipelineTable.tsx src/test/PipelinePage.test.tsx src/test/pipelineStore.test.ts src/store/pipelineStore.ts`.
- Independent source review passed with non-blocking P2/P3 follow-ups: `.agents/reviews/review-20260504-033220.md`.
- Independent test audit passed with no P0/P1 gaps: `.agents/reviews/test-audit-20260504-033951.md`.
- `npm run typecheck` remains blocked by unrelated existing errors in `src/routes/prep/PrepPage.tsx` for missing `createDeck` and `setActiveDeck`.
