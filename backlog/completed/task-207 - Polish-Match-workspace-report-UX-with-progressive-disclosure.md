---
id: TASK-207
title: Polish Match workspace report UX with progressive disclosure
status: Done
assignee:
  - '@codex'
created_date: '2026-05-03 22:39'
updated_date: '2026-05-06 20:36'
labels:
  - feature
  - match
  - ux
dependencies: []
references:
  - src/routes/match/MatchPage.tsx
  - src/routes/match/match.css
  - src/test/MatchPage.test.tsx
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Match workspace currently renders the JD input, vector-aware analysis, report summary, evidence, requirements, gaps, and history as a long flat page. The surface needs a focused UI/UX pass so the primary workflow is clear, dense report sections are progressively disclosed, and generated reports have lightweight floating navigation for scanning. Keep the scope limited to the Match workspace and its tests/styles; avoid Letters and unrelated workspace shell changes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Match workspace has a clearer primary flow for paste/analyze/review/actions without hiding required setup states.
- [x] #2 Dense generated-report sections use progressive disclosure so users can scan summary, advantages, requirements, evidence, gaps, and history without a wall of content.
- [x] #3 A floating or sticky report navigation affordance appears when a report exists and links to the major Match sections.
- [x] #4 Responsive styling preserves readable layout and usable actions on narrow viewports.
- [x] #5 Focused MatchPage tests cover the new disclosure/navigation behavior.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Keep the scope to src/routes/match/MatchPage.tsx, src/routes/match/match.css, and src/test/MatchPage.test.tsx.
2. Add accessible section anchors and a sticky/floating report navigator that appears only when a current match report exists.
3. Convert dense report areas into progressive-disclosure sections using native details/summary so keyboard and screen-reader behavior stays intact.
4. Tighten Match styling for report cards, disclosure states, nav, and responsive behavior without changing app-wide shell or Letters files.
5. Add focused MatchPage tests for the report navigator and disclosure behavior.
6. Run focused Match tests, typecheck/lint/build as practical, then update TASK-207 acceptance criteria and notes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started TASK-207 after local backlog search found no existing Match workspace UX task. Backlog remote fetch is currently blocked by an existing git commit-graph lock, so commands are running with BACKLOG_REMOTE_OPERATIONS=false to avoid touching the lock.

Implemented Match workspace UX polish in src/routes/match/MatchPage.tsx and src/routes/match/match.css with a sticky report nav, workflow rail, controlled details-based report disclosures, responsive nav behavior, hash deep-link handling, and summary/body accessibility wiring. Added focused coverage in src/test/MatchPage.test.tsx for nav visibility, workflow rail readiness, disclosure defaults, empty states, hash open/cleanup, history nav, and repeat nav reopening after manual collapse.

Verification receipts: pnpm vitest run src/test/MatchPage.test.tsx passed 14/14; npx eslint src/routes/match/MatchPage.tsx src/test/MatchPage.test.tsx --no-warn-ignored passed; git diff --check for the three scoped files passed; Playwright browser smoke via webapp-testing with local Vite server passed nav open/manual close/reopen, summary aria-controls/body region, hash update, and gaps meta checks. diff-test-audit latest clean of P0/P1 at .agents/reviews/test-audit-20260503-192440.md; later source review drove additional controlled-disclosure and a11y fixes. App-wide npx tsc --noEmit -p tsconfig.app.json and pnpm build remain blocked by pre-existing src/routes/prep/PrepPage.tsx createDeck/setActiveDeck missing-name errors, so DoD all-tests/build are intentionally left unchecked.

Follow-up style correction after visual review: replaced undefined Match-only CSS tokens with shared Facet tokens (bg-surface/bg-inset/shadow-xs/sm/error/etc.), restored workspace page padding/max-width/scroll behavior consistent with Research/Prep/Letters patterns, changed panel/card radius and button treatment to match route-scoped component grammar, added semantic tone classes for fit/requirements/advantages/gaps/evidence, fixed the sticky nav collapsed-height regression, and added nested progressive disclosure inside vector summary, advantages, requirements, evidence groups, and gaps. Added MatchPage test coverage for nested disclosure defaults and rerender persistence.

Follow-up receipts: pnpm vitest run src/test/MatchPage.test.tsx passed 15/15; npx eslint src/routes/match/MatchPage.tsx src/test/MatchPage.test.tsx --no-warn-ignored passed; git diff --check passed; browser smoke verified page padding 16px 24px 24px, visible 40px sticky nav, panel shadow from shared token, nav opening Requirements, and nested requirement disclosure opening. Source review artifact .agents/reviews/review-20260503-212552.md still marked BLOCKED, but its remaining P1s were either verified false/currently satisfied (MatchGapSeverity is exported; nested disclosures are keyed by report) or addressed after the artifact with the Record<MatchGapSeverity, MatchTone> map. App-wide type/build still blocked by unrelated PrepPage createDeck/setActiveDeck errors.

2026-05-06 closure: All 5 ACs satisfied; focused MatchPage tests passed (15/15); scoped ESLint clean; browser smoke verified nav, padding, disclosure behavior. DoD #3 and #6 unchecked because app-wide tsc/build are blocked by unrelated PrepPage createDeck/setActiveDeck baseline errors — out of scope for this Match polish. Closing as Done.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
