---
id: TASK-213
title: Reuse existing Pipeline entries when saving researched JDs
status: Done
assignee: []
created_date: '2026-05-04 20:23'
updated_date: '2026-05-04 20:51'
labels:
  - pipeline
  - research
  - jd-analysis
dependencies: []
references:
  - src/routes/research/ResearchPage.tsx
  - src/routes/research/researchUtils.ts
  - src/test/ResearchPage.test.tsx
  - src/routes/match/MatchPage.tsx
  - src/routes/match/matchPipeline.ts
  - src/test/MatchPage.test.tsx
  - src/test/matchPipeline.test.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Saving a researched job description to the Pipeline currently always creates a new entry. Detect matching existing Pipeline entries for the same company/role before creating a new entry, and update/link the existing entry instead of duplicating it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Saving a researched JD checks existing Pipeline entries for a matching company and role before creating a new entry.
- [x] #2 When a match is found, the existing entry is updated with the saved research/JD context instead of adding a duplicate.
- [x] #3 When no match is found, the existing save-to-Pipeline behavior still creates a new entry.
- [x] #4 The save flow still navigates to the Pipeline after a successful save.
- [x] #5 Focused tests cover both duplicate-match reuse and new-entry creation behavior.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented conservative company/role matching for MatchPage Save to Pipeline. Matching ignores deleted and terminal Pipeline entries, reuses the most recent active match, attaches the current JD analysis, refreshes JD text, and preserves workflow/user-owned fields on existing entries.

Verification passed: npx vitest run src/test/MatchPage.test.tsx src/test/matchPipeline.test.ts (26 tests), npx eslint src/routes/match/MatchPage.tsx src/routes/match/matchPipeline.ts src/test/MatchPage.test.tsx src/test/matchPipeline.test.ts, and npm run typecheck.

Independent source review passed with no P0/P1 blockers: .agents/reviews/review-20260504-163650.md and follow-up .agents/reviews/review-20260504-163932.md. Independent test audit passed with no P0/P1 gaps: .agents/reviews/test-audit-20260504-164832.md.

Implementation targeted the JD Match save-to-Pipeline flow in `src/routes/match/MatchPage.tsx`; it extracts duplicate detection into `src/routes/match/matchPipeline.ts` and covers the behavior with Match page/helper tests.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Save to Pipeline now checks for an active matching Pipeline entry by normalized company and role before creating a new entry. It reuses the most recent active match, skips deleted or terminal entries, attaches the current JD analysis to the target entry, preserves user-owned workflow fields, and keeps the create path for non-matches. Focused tests cover matching, non-match creation, terminal/deleted skips, update preservation, blank-field fill, and helper normalization.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
