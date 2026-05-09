---
id: TASK-246
title: Wire run refresh into batch staleness review with cost confirmation
status: To Do
assignee: []
created_date: '2026-05-09'
updated_date: '2026-05-09'
labels:
  - shepherding
  - staleness
  - refresh
  - cost-ux
milestone: m-27
dependencies:
  - TASK-158
  - TASK-244
references:
  - src/routes/research/stalenessRefreshHandlers.ts
  - src/utils/deepSearchClient.ts
  - src/store/searchStore.ts
documentation:
  - 'backlog task-158: Add artifact staleness detection and refresh triggers'
  - 'backlog task-244: Wire prep deck refresh into batch staleness review'
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-158 + TASK-244 closed the batch staleness review refresh paths for thesis, cover-letter, and prep-deck artifacts. **Search runs** are the only artifact type still gated behind "run-level refresh isn't available yet" copy in the panel. Re-firing a deep-search run costs $5-15 per call and runs for 60-120 seconds, so this surface needs cost-confirmation UX before the refresh button can ship.

**Pattern to follow:** mirror the existing `runCoverLetterRefresh` / `runPrepDeckRefresh` factories in `src/routes/research/stalenessRefreshHandlers.ts`. The shared mechanical shell (try/catch/finally + the post-flight identity-drift guard) already exists via `withStaleArtifactRefreshGuards`. New work scope:

1. **Cost confirmation modal/panel.** Before kicking off the deep-search re-fire, surface estimated cost (pull from `fetchResearchUsage` or the run's recorded `usageSnapshot`) and the active proxy's per-call rate. User must confirm or cancel.

2. **Run regen action.** Look up the saved run by id, find its source thesis (snapshot is on the run), call `createDeepResearchJob` with the latest identity context applied to the thesis snapshot, stream results, hydrate the run record via `hydrateSearchRunFromResearchJob`, stamp `accepted-current` staleness review.

3. **In-flight UX.** Refresh runs are slow (60-120s). The button needs a clear in-progress state distinct from the snappier thesis/cover/prep refreshes; consider a progress indicator pulled from the existing `ResearchJobElapsedTimer`.

4. **Failure semantic.** If the deep-search call fails (rate-limit, billing issue, proxy down), the original run record must remain intact and the user must see the specific error. The post-flight drift guard already exists; this is about pre-flight failure handling.

**Why this was deferred:**

The cost UX is a meaningful design surface — modal vs. inline confirm, what cost detail to show, how to gate when the proxy doesn't expose pricing. None of that exists today. The other three artifact types had no such gate (their generation calls are cheap), so they shipped without confirmation. Run regen needs the gate before the panel button can be enabled.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Stale runs in the batch staleness review show a "Refresh search run" button (not "Refresh pending")
- [ ] #2 Clicking refresh surfaces a cost confirmation step before any deep-search call is initiated
- [ ] #3 User can cancel from the cost confirmation without side effects
- [ ] #4 On confirm, the run is re-generated against the latest Identity-applied thesis snapshot via createDeepResearchJob + streaming
- [ ] #5 Mid-flight identity drift recovery follows the same partial-success semantic as cover-letter / prep-deck handlers
- [ ] #6 Pre-flight failure (rate limit, billing, proxy down) surfaces a specific error and leaves the original run intact
- [ ] #7 In-progress visual state distinct from snappier refresh button states (60-120s wait)
- [ ] #8 Panel copy updated: drop "run-level refresh isn't available yet" once the button ships
- [ ] #9 Regression test for cost-confirmation flow (cancel vs. confirm) and dispatcher routing
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
