---
id: TASK-229
title: 'Phase 7: refactor prep generator to apply candidate audience projection'
status: To Do
assignee: []
created_date: '2026-05-06 20:28'
labels:
  - audience-tagging
  - phase-7
  - prep
milestone: m-28
dependencies: []
references:
  - src/utils/prepGenerator.ts
  - src/routes/prep/PrepPage.tsx
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

Prep content is candidate-only by definition — it's the candidate preparing for an interview. Currently the prep generator consumes JDAnalysis but doesn't filter; recruiter-advocacy material can leak into prep cards.

## What

- Apply `projectForAudience(jd, 'candidate')` in `src/utils/prepGenerator.ts` before content extraction
- Verify all current prep card sections still populate (gaps, watch outs, awareness all default to candidate audience)
- Update tests to use the production-shaped fixture pattern (JDAnalysisLike + applyRulesBasedAudiences)
- Browser-verify nothing disappears that should be present

## Acceptance criteria

- Generator uses projected JDAnalysis as the source of truth
- Existing prep card sections still populate from real fixtures
- Tests use production-shaped audience fixtures
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
