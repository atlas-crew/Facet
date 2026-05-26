---
id: TASK-228
title: >-
  Phase 7: refactor cover letter generator to JDAnalysis with hiring_manager
  projection
status: In Progress
assignee:
  - '@codex'
created_date: '2026-05-06 20:28'
updated_date: '2026-05-26 13:50'
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
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-05-26 Codex starting TASK-228. Plan: inspect coverLetterGenerator, LettersPage, canonical JDAnalysis fixtures/tests, refactor generator to use hiring_manager projection, wire LettersPage to currentJDAnalysis, add production-shaped audience coverage, run focused gates plus browser check, independent review/audit, commit/close/push.
<!-- SECTION:NOTES:END -->
