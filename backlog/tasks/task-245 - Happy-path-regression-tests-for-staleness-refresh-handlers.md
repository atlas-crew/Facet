---
id: TASK-245
title: Happy-path regression tests for staleness refresh handlers
status: To Do
assignee: []
created_date: '2026-05-08'
updated_date: '2026-05-08'
labels:
  - tests
  - staleness
  - refresh
milestone: m-27
dependencies:
  - TASK-158
  - TASK-244
references:
  - src/routes/research/stalenessRefreshHandlers.ts
  - src/test/ResearchPage.test.tsx
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-158 and TASK-244 shipped the cover-letter and prep-deck refresh paths in the batch staleness review. Multi-perspective code review (run 2026-05-08) flagged that the regression tests for these handlers are **negative-path only** — they verify the dispatcher routes correctly to each handler and the missing-prerequisite guards fire, but no test exercises a successful regen flow end-to-end.

The thesis refresh has 5 race-condition / success-path tests. Cover-letter and prep-deck refresh have zero. The shipped wiring works (verified manually + via 57 LettersPage integration tests covering the shared `regenerateCoverLetterForEntry` contract), but a regression in the ResearchPage handler factories would not be caught.

This task adds happy-path tests for both handlers, plus the mid-flight identity-drift recovery copy that is currently untested.

**Test surface to add:**

1. **Cover-letter refresh — success.** Seed pipeline entry + resume + non-stale JD analysis. Mock `generateCoverLetter` to return content. Click refresh. Assert the mock was called with the correct identity revision; the cover letter was upserted; the staleness review marker is recorded with `decision: 'accepted-current'`.

2. **Cover-letter refresh — mid-flight identity drift.** Same setup, but mutate `currentIdentity.model_revision` between the AI call and the post-flight check. Assert the regenerated letter is persisted but the staleness review marker is NOT recorded; the user-facing notice surfaces the partial-success copy.

3. **Prep-deck refresh — success.** Seed pipeline entry + (optional resume) + non-stale JD analysis. Mock `generateInterviewPrep` to return a valid result with `cards`, `deck`, and the optional rules/donts/etc. Click refresh. Assert the mock was called; the deck was updated via `updateDeck` + `replaceDeckCards` (preserving any non-AI cards); the staleness review marker is recorded.

4. **Prep-deck refresh — mid-flight identity drift.** Mirror of test 2 for the deck path.

5. **Refresh button serialization.** Start a refresh on artifact A, click refresh on artifact B before A finishes. Assert the second click shows the "A refresh is already running" notice and does NOT call the second AI mock.

6. **`generateInterviewPrep` failure.** Mock the prep generator to reject with an error. Click refresh. Assert `setPageError` surfaces the error message and the deck is NOT mutated.

**Fixture work required:**

- Build a `makeMinimalJdAnalysis` helper (mirror of LettersPage.test.tsx's `makeJdAnalysis`) inside ResearchPage.test.tsx or extract to a shared test fixture file under `src/test/fixtures/`.
- Build a `makeMinimalPipelineEntry` helper for the same reason.
- The `mockGenerateCoverLetter` and `mockGenerateInterviewPrep` mocks already exist in ResearchPage.test.tsx (added in the multi-perspective polish phase).

**Why this was deferred:**

The full fixture chain (JDAnalysis has ~30 required fields, PipelineEntry has ~25) is mechanical but tedious — easily ~150 lines of fixture code shared across the new tests. Writing all six tests in a focused session with a fixture-extraction up front is cleaner than squeezing them into the multi-perspective polish phase.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Happy-path test for cover-letter refresh asserting AI mock called with correct identity revision and stalenessReview marker recorded
- [ ] #2 Mid-flight identity drift test for cover-letter refresh asserting persist-but-no-marker partial-success behavior
- [ ] #3 Happy-path test for prep-deck refresh asserting AI mock called and deck mutations recorded
- [ ] #4 Mid-flight identity drift test for prep-deck refresh
- [ ] #5 Refresh-already-running serialization test (second click ignored with notice)
- [ ] #6 Generator-failure test asserting setPageError surfaces and artifact is not mutated
- [ ] #7 Fixture helpers (makeMinimalJdAnalysis, makeMinimalPipelineEntry) extracted or inlined
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
