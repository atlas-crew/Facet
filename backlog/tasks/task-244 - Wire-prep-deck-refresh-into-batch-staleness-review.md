---
id: TASK-244
title: Wire prep deck refresh into batch staleness review
status: To Do
assignee: []
created_date: '2026-05-08'
updated_date: '2026-05-08'
labels:
  - shepherding
  - staleness
  - refresh
  - prep
milestone: m-27
dependencies:
  - TASK-158
references:
  - src/routes/research/ResearchPage.tsx
  - src/utils/prepGenerator.ts
  - src/store/prepStore.ts
documentation:
  - 'backlog task-158: Add artifact staleness detection and refresh triggers'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-158 closed AC #6 with thesis and cover-letter refresh paths; prep deck refresh was deliberately deferred because `src/utils/prepGenerator.ts` was being concurrently edited by another agent during the TASK-158 work session. Once that work stabilizes, wire prep deck refresh into the batch staleness review using the same dispatch pattern.

**Pattern to follow:** mirror the `runCoverLetterRefresh` handler added to `ResearchPage.tsx` in TASK-158 AC #6. Each per-artifact refresh handler:

1. Looks up the target artifact from its store via the artifactId in the staleness review.
2. Looks up the transitive dependencies (for prep deck: pipeline entry, JD analysis).
3. Calls a shared regen action (the cover-letter case extracted `regenerateCoverLetterForEntry` into `src/utils/coverLetterRegen.ts` — consider extracting an analogous shared `regeneratePrepDeckForEntry` if PrepPage's regen logic is non-trivial).
4. Records `accepted-current` staleness review on the regenerated artifact.
5. Surfaces specific notices for missing prerequisites (no pipeline entry, no JD analysis, etc.).

**Open design questions:**
- Does prep deck regen require fresh JD analysis, or does it tolerate the existing JD analysis even when stale? The cover-letter case rejects regen when `getJdAnalysisDriftStatus` reports drift; the prep case may want the same.
- Does refresh preserve the user's manual card edits (which would conflict with the AI-generated card set), or is the deck wholly replaced? Decide based on prep deck mutation semantics.

**Out of scope:** run regen (cost UX is its own surface — re-firing deep search is $5-15 per call and needs a confirmation flow before any refresh button shows up in the batch review).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Stale prep decks in the batch staleness review show a "Refresh prep deck" button (not "Refresh pending")
- [ ] #2 Clicking refresh re-runs prep generation against current Identity + same JD analysis
- [ ] #3 Regenerated deck stamps the current identity_revision and clears stale review state
- [ ] #4 Missing pipeline entry, missing JD analysis, or stale JD analysis surfaces a specific notice (no silent failure)
- [ ] #5 Refresh records `accepted-current` staleness review marker on the regenerated deck
- [ ] #6 Panel copy updated: only "run refresh generators are still pending" remains (drop "prep deck" from pending list)
- [ ] #7 Regression coverage in src/test/ResearchPage.test.tsx verifying the dispatch routes correctly and the regen mock is called with current identity
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
