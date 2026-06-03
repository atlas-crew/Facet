---
id: TASK-230
title: 'Phase 7: refactor debrief generator to apply candidate audience projection'
status: Done
assignee:
  - '@codex'
created_date: '2026-05-06 20:28'
updated_date: '2026-05-26 08:22'
labels:
  - audience-tagging
  - phase-7
  - debrief
milestone: m-28
dependencies: []
references:
  - src/utils/debriefGenerator.ts
  - src/routes/debrief/DebriefPage.tsx
modified_files:
  - src/utils/debriefGenerator.ts
  - src/routes/debrief/DebriefPage.tsx
  - src/types/debrief.ts
  - src/test/debriefGenerator.test.ts
  - src/test/DebriefPage.test.tsx
  - src/test/fixtures/jdAnalysisAudienceFixture.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

Debriefs are candidate-only — post-interview reflection material. Same audience filter logic as prep. Currently no audience filter is applied.

## What

- Apply `projectForAudience(jd, 'candidate')` in the debrief generator before content extraction
- Verify debrief sections (anchor stories, reflection prompts) still populate correctly
- Update tests with production-shaped fixtures

## Acceptance criteria

- Debrief generator uses projected JDAnalysis
- Existing sections still populate
- Tests use production-shaped audience fixtures
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
2026-05-26 Codex starting TASK-230. Plan: inspect debriefGenerator/DebriefPage and current tests, apply candidate projection at the generator boundary, update production-shaped audience fixtures, run focused gates plus independent review/audit, commit/close/push.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented candidate-audience projection for debrief generation. Debrief requests now optionally carry canonical JDAnalysis; DebriefPage passes current match analysis or the linked/latest pipeline analysis, and generateDebriefReport projects it via projectForAudience(jdAnalysis, 'candidate') before prompt formatting. Added production-shaped audience fixtures and tests covering candidate projection, recruiter/internal filtering, match fallback notes, missing-positioning fallback, pipeline jdAnalysisId resolution, and latest-analysis fallback. Verification: npx vitest run src/test/debriefGenerator.test.ts src/test/DebriefPage.test.tsx (8/8), npm run typecheck, npm run lint, npm run test (175 files/2641 tests), npm run build. Independent review: .agents/reviews/review-20260526-041218.md CLEAN. Diff test audit: .agents/reviews/test-audit-20260526-042015.md no prioritized gaps.
<!-- SECTION:FINAL_SUMMARY:END -->
