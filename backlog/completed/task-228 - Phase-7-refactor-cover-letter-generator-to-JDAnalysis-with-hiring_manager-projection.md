---
id: TASK-228
title: >-
  Phase 7: refactor cover letter generator to JDAnalysis with hiring_manager
  projection
status: Done
assignee:
  - '@codex'
created_date: '2026-05-06 20:28'
updated_date: '2026-05-26 14:11'
labels:
  - audience-tagging
  - phase-7
  - cover-letter
milestone: m-28
dependencies: []
references:
  - src/utils/coverLetterGenerator.ts
  - src/routes/letters/LettersPage.tsx
  - src/utils/audienceFilter.ts
modified_files:
  - src/utils/coverLetterGenerator.ts
  - src/test/coverLetterGenerator.test.ts
  - src/test/LettersPage.test.tsx
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

Cover letters are addressed to the hiring manager. The generator currently consumes a `MatchReport` and produces text mixing all-audience material. Phase 6 established the pattern (recruiter card → JDAnalysis + projection); cover letter is the next port.

## What

- Refactor `src/utils/coverLetterGenerator.ts` to take `JDAnalysis` instead of `MatchReport`
- Use `projectForAudience(jd, 'hiring_manager')` to filter inputs
- Drop content the audience tags route to candidate/recruiter-only (positioning angles for recruiter pitch, gap focus that's candidate-prep)
- Update `LettersPage.tsx` to read `currentJDAnalysis` from matchStore
- Rebuild fixtures using `JDAnalysisLike` + `applyRulesBasedAudiences` so audience tags match production

## Acceptance criteria

- `generateCoverLetter` signature accepts JDAnalysis
- LettersPage reads currentJDAnalysis (currentReport stays as a fallback only if explicitly designed)
- Tests use the production-shaped fixture pattern
- Browser-verified: cover letter generation works end-to-end
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
2026-05-26 Codex starting TASK-228. Plan: inspect coverLetterGenerator, LettersPage, canonical JDAnalysis fixtures/tests, refactor generator to use hiring_manager projection, wire LettersPage to currentJDAnalysis, add production-shaped audience coverage, run focused gates plus browser check, independent review/audit, commit/close/push.

2026-05-26 Codex completed implementation. Refactored coverLetterGenerator to accept full JDAnalysis and project to hiring_manager before prompt formatting. LettersPage source already resolves canonical pipeline JDAnalysis via resolvePipelineJdAnalysis, so no Match workspace currentJDAnalysis fallback was added; tests now prove the pipeline JDAnalysis path feeds the hiring-manager projection. Updated fixtures to use JDAnalysisLike + applyRulesBasedAudiences and added prompt assertions for retained HM material plus filtered candidate/recruiter/internal-only material.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented TASK-228. generateCoverLetter now accepts JDAnalysis, projects it through projectForAudience(..., 'hiring_manager'), labels the Canonical JD Analysis prompt block, and instructs the model not to recover omitted candidate/recruiter/internal-only material. Updated cover-letter and LettersPage tests to use production-shaped JDAnalysisLike fixtures with applyRulesBasedAudiences and to assert hiring-manager content survives while candidate gap focus, recruiter positioning, and internal warnings are filtered out. Verification: focused Vitest 93/93 pass; typecheck pass; lint pass; full Vitest 2641/2641 pass; production build pass; browser Playwright flow generated and linked a cover letter with no audience leaks; independent code review PASS WITH ISSUES (P2 only); final diff test audit no gaps.
<!-- SECTION:FINAL_SUMMARY:END -->
