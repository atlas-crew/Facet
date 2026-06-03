---
id: TASK-229
title: 'Phase 7: refactor prep generator to apply candidate audience projection'
status: Done
assignee:
  - '@codex'
created_date: '2026-05-06 20:28'
updated_date: '2026-05-09 04:27'
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
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Starting TASK-229 as the next doc-41 closeout slice. Plan: inspect audience projection utilities and prep generator JDAnalysis consumption, apply candidate projection before prompt/context extraction, update focused generator tests with production-shaped audience fixtures, run scoped format/test/lint/build, then close if receipts pass or only unrelated build debt remains.

Implemented candidate-audience projection in prep generation. generateInterviewPrep now projects JDAnalysis with projectForAudience(jd, 'candidate') before prompt serialization and stack-confidence ceiling calculation. Focused tests use applyRulesBasedAudiences/JDAnalysisLike production-shaped fixtures to prove recruiter-only requirements/evidence are filtered while candidate gaps, watch-outs, awareness, positioning, and strong evidence remain. Verification: format:files passed; npx vitest run src/test/prepGenerator.test.ts passed (22 tests); scoped ESLint passed; npm run build attempted and remains blocked only by unrelated src/test/identityFieldDeps.test.ts SkillMatch export debt. Review: /Users/nick/Developer/Facet/.agents/reviews/review-20260509-002607.md PASS WITH ISSUES, no P0/P1; P2 cleanup applied for projection typing/comment/prompt guidance.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Prep generation now consumes a candidate-projected Canonical JD Analysis instead of the full analysis payload. The prompt receives audience: candidate plus candidate-visible requirements/evidence/gaps/watch-outs/awareness, and stack-alignment confidence ceilings are derived from the same projected source. Tests were updated to production-shaped audience fixtures and verify recruiter-only material is omitted from prep context. No UI changes required.
<!-- SECTION:FINAL_SUMMARY:END -->
