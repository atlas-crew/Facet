---
id: TASK-163
title: Add SearchFeedbackEvent schema and store contract
status: Done
assignee: []
created_date: '2026-04-19 09:00'
updated_date: '2026-04-20 05:47'
labels:
  - search-redesign
  - types
  - feedback
  - foundation
milestone: m-20
dependencies:
  - TASK-152
references:
  - src/types/search.ts
  - src/store/searchStore.ts
documentation:
  - 'backlog doc-24: Identity Model Lifecycle, Feedback Event Schema subsection'
  - 'backlog doc-26: Stage 3 Discovery Extraction'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Define the `SearchFeedbackEvent` type and add a feedback events collection to `searchStore`. This decouples feedback capture from identity writeback and from thesis regeneration — two downstream consumers in the redesign.

**Type definition** (`src/types/search.ts`):

```typescript
type FeedbackRating = 'up' | 'down'

interface SearchFeedbackDimensions {
  skill?: {
    name: string
    suggestedDepth?: string   // e.g., "this should be 'conceptual' not 'strong'"
  }
  preference?: {
    category: 'prioritize' | 'avoid'
    label: string
    condition?: string         // qualifying condition for the filter
  }
  vector?: {
    title: string
    thesis?: string
  }
}

interface SearchFeedbackEvent {
  id: string
  runId: string                          // SearchRun this event was raised against
  resultId: string                        // SearchResultEntry within the run
  rating: FeedbackRating
  reason?: string                         // Optional free-text rationale
  dimensions?: SearchFeedbackDimensions   // Structured signal
  appliedToIdentity: boolean              // Has the identity model absorbed this yet?
  appliedAtVersion?: number               // Identity version when absorption happened
  reflectedInThesisId?: string            // Which thesis version first incorporated it
  createdAt: string
}
```

**Store extensions** (`src/store/searchStore.ts`):
- Add `feedbackEvents: SearchFeedbackEvent[]` to store state
- `addFeedbackEvent(event: Omit<SearchFeedbackEvent, 'id' | 'createdAt'>): SearchFeedbackEvent`
- `markFeedbackApplied(id: string, identityVersion: number): void` — sets `appliedToIdentity=true` and records version
- `markFeedbackReflectedInThesis(ids: string[], thesisId: string): void` — called when a new thesis incorporates a batch of events
- `getUnreflectedFeedback(currentThesisId?: string): SearchFeedbackEvent[]` — returns events that are `appliedToIdentity === true` and `reflectedInThesisId !== currentThesisId`, for thesis regeneration input

**Migration:**
- Additive to persisted state; existing searchStore data compatible after migration initializes `feedbackEvents: []`

**What this task does NOT do:**
- The UI actions that create feedback events → TASK-151.3
- The identity writeback logic that sets `appliedToIdentity=true` → TASK-151.3
- The thesis regeneration that consumes unreflected feedback → TASK-151.1

This task is purely schema and store contract so downstream tasks can implement against a stable interface.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 SearchFeedbackEvent type and SearchFeedbackDimensions type defined in src/types/search.ts with all fields from spec
- [ ] #2 searchStore has feedbackEvents array in state, hydrated from persisted state
- [ ] #3 addFeedbackEvent() creates and returns event with generated id and timestamp
- [ ] #4 markFeedbackApplied() updates appliedToIdentity and appliedAtVersion
- [ ] #5 markFeedbackReflectedInThesis() updates reflectedInThesisId for a batch of events
- [ ] #6 getUnreflectedFeedback() returns events eligible for thesis regeneration input
- [ ] #7 Store migration handles existing persisted state without data loss
- [ ] #8 Unit tests cover every store action and selector path
- [ ] #9 Type exports added to barrel files where needed
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Shipped SearchFeedbackEvent schema + searchStore contract + full persistence integration.

**Types (`src/types/search.ts`):**
- `SearchFeedbackEvent` with id, runId, resultId, rating (`'up' | 'down'`), optional reason/dimensions, `appliedToIdentity` flag with optional `appliedAtVersion` (TASK-159 version), optional `reflectedInThesisId`, `createdAt`.
- `SearchFeedbackDimensions` with optional `skill`, `preference`, `vector` sub-objects.

**Store (`src/store/searchStore.ts`):**
- `feedbackEvents: SearchFeedbackEvent[]` state.
- `addFeedbackEvent(input)` generates id + timestamp.
- `markFeedbackApplied(id, identityVersion)` flips `appliedToIdentity` + records version.
- `markFeedbackReflectedInThesis(ids, thesisId)` batch marks events.
- `getUnreflectedFeedback(currentThesisId?)` returns applied-but-not-reflected events; treats missing thesisId as "fresh thesis from scratch" (returns all applied).
- `getFeedbackEventsForRun(runId)` filter.
- `migrateSearchState` initializes `feedbackEvents: []` on pre-163 snapshots.

**Persistence (backward-compatible):**
- `ResearchWorkspaceData.feedbackEvents?` optional for backward compat.
- Snapshot builder includes feedbackEvents; hydration defaults to `[]` when absent.
- Validation accepts missing/array, rejects non-array.
- Import-merge deduplicates by id.

**Tests (10 new, all passing):** covers every action, both `getUnreflectedFeedback` branches, the migration path for legacy snapshots, and isolation between events during mutation.

**Commit:** `a99903f` series continues — this one's the feedback foundation.

Stats: 1283 → 1293 tests (+10). Typecheck clean, lint clean on all touched files. Pre-existing `searchExecutor.test.ts:405` proxy-error flake remains untouched.

**What this unblocks:**
- TASK-151.3 can now define the UI action that creates events (via `addFeedbackEvent`) and the writeback logic that calls `markFeedbackApplied`.
- TASK-151.1 thesis regeneration can call `getUnreflectedFeedback(currentThesisId)` to pull events into its prompt, then `markFeedbackReflectedInThesis(ids, newThesisId)` once the new thesis is generated.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
