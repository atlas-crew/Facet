---
id: TASK-203
title: >-
  Remove dead per-run search overrides (companySizeOverride,
  salaryAnchorOverride)
status: Done
assignee: []
created_date: '2026-04-30 23:23'
updated_date: '2026-04-30 23:28'
labels:
  - search-redesign
  - cleanup
dependencies: []
references:
  - src/types/search.ts
  - src/routes/research/researchUtils.ts
  - src/routes/research/ResearchPage.tsx
  - src/test/ResearchPage.test.tsx
documentation:
  - backlog doc-34 (Search Parameters Surface — Design)
  - backlog doc-24 (Search Workspace Redesign)
  - backlog doc-4 (Deep Job Research Implementation Plan)
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

The Search Launcher tab exposes two fields — "Company size override" and "Salary anchor override" — that initialize from `thesis.searchOverrides.constraints.{companySize,compensation}`. After the user "edits" them, they're stamped onto `SearchRequest.params.companySizeOverride` and `SearchRequest.params.salaryAnchorOverride`.

**Production code never reads those request params.** The deep-research runner consumes only `thesisSnapshot.searchOverrides`. The fields are dead-on-arrival aspirations: someone planned a runner fast-path (`doc-4` references them in the original implementation plan) that was never wired. Today they're a UX redundancy where the user thinks they've already set salary/company size on the Profile Editor's `SearchInstancePreferences` card and is then asked to set them again on Search Launcher.

This contradicts the architecture in `doc-34` ("per-search overrides live in `SearchInstanceOverrides`, never in identity; per-search filter toggles happen via `disabledFilterIds[]`, not duplicate runtime fields"). Removing the run-override fields is enforcement of that doc, not a new design decision.

## Scope

Delete the two fields from end to end:

1. `SearchRequest` type — drop `companySizeOverride` and `salaryAnchorOverride` from `params`.
2. `buildRequestDraft` (`src/routes/research/researchUtils.ts`) — stop populating them.
3. Search Launcher UI (`ResearchPage.tsx` ~lines 2952–2985) — remove the two `<label>` blocks.
4. Tests that reference the fields — update to drop the keys (most are passive `'' ` defaults; the propagation test at `ResearchPage.test.tsx:1397-1447` asserts the legacy double-channel behavior and should be reduced to assert only `thesisSnapshot.searchOverrides` propagation).

## Out of scope

- The hard-constraints UI rebuild (industries, funding stages, salary bands) — that's TASK-196 and its subtasks. This cleanup is a prerequisite that simplifies the surface before TASK-196's UI lands.
- Consolidating `lookFor` / `filters.prioritize` / `interviewPrefs.strongFit` (three-way overlap) — separate question; surface architecture discussed in `doc-34` Section 7 but not yet decomposed into a task.
- The `avoid` / `filters.avoid` two-way duplication — same; track separately if we decide to consolidate.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 companySizeOverride and salaryAnchorOverride are removed from the SearchRequest type
- [x] #2 buildRequestDraft no longer references these fields
- [x] #3 The two corresponding inputs are removed from the Search Launcher card
- [x] #4 All test references to the two fields are updated; the propagation test asserts only thesisSnapshot.searchOverrides
- [x] #5 Production code grep for companySizeOverride and salaryAnchorOverride returns zero results
- [x] #6 Manual flow: setting companySize/compensation in SearchInstancePreferences flows through to the deep-research backend with no Search Launcher edits required
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## What changed

- `SearchRequest.params.companySizeOverride` and `params.salaryAnchorOverride` removed from `src/types/search.ts:124-125`. The runner only consumes `thesisSnapshot.searchOverrides`, so these fields were dead-on-arrival aspirations from the original `doc-4` plan.
- `buildRequestDraft` in `src/routes/research/researchUtils.ts` no longer takes a `thesisOverrides` parameter and no longer populates the dead fields. Callers pass two args (`profile`, `activeThesis`) instead of three.
- The two corresponding `<label>` blocks were removed from the Search Launcher card in `ResearchPage.tsx`. The local `COMPANY_SIZE_OPTIONS` array and `SearchCompanySize` import that supported them were also dropped (no other consumers).
- `splitLegacySaveAndMapFields` is unaffected — these run-overrides never lived on `thesisDraft`.

## Test sweep

- `researchUtils.test.ts` — dropped the "prefers thesis searchOverrides over profile constraints" test (asserted the now-deleted run-override fallback path); other tests reduced to 2-arg `buildRequestDraft`.
- `ResearchPage.test.tsx` propagation test reduced to assert only `thesisSnapshot.searchOverrides` (the surviving channel). Test name updated from "...into both request params and snapshot" to "...into the snapshot".
- 7 other test files (`searchStore`, `searchStore.thesisMap`, `deepSearchClient`, `researchJobs`, `searchExecutor`, `searchRedesignRoundTrip`, `ResearchPage` fixtures) had passive `companySizeOverride: ''`/`salaryAnchorOverride: ''` placeholders stripped via batch sed.
- Net delta: 1796 → 1795 tests (one purpose-built test deleted; no coverage of live code lost).

## Verification

- `npm run typecheck` — clean
- `npm run test` — 1795/1795 passing
- `npm run build` — succeeds
- Production grep for `companySizeOverride` / `salaryAnchorOverride` returns zero matches outside the backlog `doc-4` historical reference and this task's own docs.

## Architectural alignment

This cleanup is enforcement of `doc-34` ("Search Parameters Surface — Design"), which already establishes that per-search overrides live exclusively in `SearchInstanceOverrides` (per-thesis) and `disabledFilterIds[]` (per-search), never in duplicate runtime fields. TASK-196's hard-constraints UI work can now build on the simpler shape.
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
