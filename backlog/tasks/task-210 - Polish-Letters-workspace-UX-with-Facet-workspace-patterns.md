---
id: TASK-210
title: Polish Letters workspace UX with Facet workspace patterns
status: In Progress
assignee:
  - '@codex'
created_date: '2026-05-04 01:56'
updated_date: '2026-05-04 02:16'
labels:
  - feature
dependencies: []
references:
  - src/routes/letters/LettersPage.tsx
  - src/routes/letters/letters.css
  - src/test/LettersPage.test.tsx
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Align the Letters workspace with Facet's internal workspace styling patterns. The page should use shared tokens and route-scoped CSS, add clearer semantic status treatment, and progressively disclose dense generator/refinement controls without changing cover-letter persistence or generation semantics.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Letters page uses the same workspace padding, width, panel depth, and token vocabulary as the corrected Match/Research surfaces.
- [x] #2 Generator setup and paragraph refinement controls are progressively disclosed while primary draft editing remains immediately available.
- [x] #3 Semantic warning/error/saved/editing states use shared success, warning, and error tokens instead of purely neutral treatment.
- [x] #4 Focused Letters tests cover progressive disclosure behavior without weakening existing generation/editing coverage.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect Letters markup/CSS/tests against Match and Research workspace patterns.
2. Patch LettersPage to add editor navigation and native disclosures for dense generator/refinement controls while preserving existing handlers and accessible labels.
3. Rework letters.css to shared tokens, panel depth, semantic status/callout colors, stable spacing, and responsive behavior.
4. Add focused tests for disclosure defaults/state and run targeted Letters tests, lint, and diff checks.
5. Commit only scoped Letters files and the backlog task receipt with cortex git commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented Letters workspace style/UX polish.

Receipts:
- pnpm vitest run src/test/LettersPage.test.tsx: PASS (54 tests)
- npx eslint src/routes/letters/LettersPage.tsx src/test/LettersPage.test.tsx --no-warn-ignored: PASS
- git diff --check -- src/routes/letters/LettersPage.tsx src/routes/letters/letters.css src/test/LettersPage.test.tsx: PASS
- Browser smoke with sample pipeline data: PASS; screenshot /tmp/facet-letters-style-pass.png; page padding 16px 24px 24px; nav height 40px; card shadow rgba(0, 0, 0, 0.04) 0px 1px 2px 0px; 4 nav buttons; paragraph nav click sets aria-current and scrolls target into view; refinement disclosure toggles closed to open.
- npx tsc --noEmit -p tsconfig.app.json: FAIL on unrelated src/routes/prep/PrepPage.tsx missing createDeck and setActiveDeck.
- pnpm build: FAIL on same unrelated PrepPage errors.
- Independent source review artifacts: .agents/reviews/review-20260503-220432.md, review-20260503-220647.md, review-20260503-220934.md, review-20260503-221256.md. Final actionable UX/correctness findings were remediated by replacing hash anchors with scroll buttons, removing disclosure remounts, and returning to page-level scrolling.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Polished the Letters workspace to match Facet workspace patterns: shared token vocabulary, page padding, panel/card depth, semantic saved/editing/error/warning states, floating section navigation, and native disclosures for generation setup plus paragraph refinement controls. Added focused regression coverage for disclosure behavior and nav/status rendering.

Full Done remains blocked by unrelated PrepPage typecheck/build errors: createDeck and setActiveDeck are undefined in src/routes/prep/PrepPage.tsx.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
