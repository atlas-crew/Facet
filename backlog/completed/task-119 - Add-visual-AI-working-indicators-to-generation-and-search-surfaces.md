---
id: TASK-119
title: Add visual AI working indicators to generation and search surfaces
status: Done
assignee: []
created_date: '2026-04-14 09:14'
updated_date: '2026-04-14 09:28'
labels:
  - ux
  - ui
  - ai
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a reusable glowing or breathing visual treatment for in-flight AI actions and expose a small live activity indicator on the main generation and search surfaces.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Primary AI action buttons show a reusable in-flight visual treatment while aria-busy is true.
- [x] #2 Main generation and search surfaces show a visible AI working indicator while requests are in flight.
- [x] #3 The indicator respects prefers-reduced-motion.
- [x] #4 Targeted typecheck, Vitest, ESLint, and build pass for the touched files.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a reusable AiActivityIndicator plus ai-working-button glow or breathing styling and wired it into the main AI generation and search surfaces, including Research, Strategy, Match, Prep, Letters, LinkedIn, Debrief, and skill enrichment. Verification: npx vitest run src/test/AiActivityIndicator.test.tsx src/test/ResearchPage.test.tsx src/test/IdentityStrategyWorkbench.test.tsx src/test/IdentityEnrichmentSkillPage.test.tsx src/test/MatchPage.test.tsx src/test/PrepPage.test.tsx src/test/LettersPage.test.tsx src/test/LinkedInPage.test.tsx src/test/DebriefPage.test.tsx; npm run typecheck; npx eslint --no-warn-ignored src/components/AiActivityIndicator.tsx src/components/aiActivity.css src/routes/research/ResearchPage.tsx src/routes/identity/IdentityStrategyWorkbench.tsx src/routes/identity/IdentityEnrichmentSkillPage.tsx src/routes/match/MatchPage.tsx src/routes/prep/PrepPage.tsx src/routes/letters/LettersPage.tsx src/routes/linkedin/LinkedInPage.tsx src/routes/debrief/DebriefPage.tsx src/test/AiActivityIndicator.test.tsx; npm run build. Review artifacts: .agents/reviews/review-20260414-051902.md, .agents/reviews/review-20260414-052553.md, .agents/reviews/test-audit-20260414-052702.md. Committed as feat(ui): add ai activity indicators.
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
