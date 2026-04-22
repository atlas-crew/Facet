---
id: TASK-188
title: Sweep orphan references on cascade-delete and workspace import merge
status: To Do
assignee: []
created_date: '2026-04-20 07:07'
labels:
  - search-redesign
  - data-integrity
  - 'origin:ai-review'
  - remediation
milestone: m-20
dependencies:
  - TASK-163
references:
  - src/store/searchStore.ts
  - src/store/uiStore.ts
  - src/persistence/workspaceImportMerge.ts
  - src/types/search.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up from the post-TASK-163 multi-specialist review (code-reviewer finding #1).

The cascade-delete in `deleteRequest` and `deleteRun` handles the primary parent-child relationship (runs, feedback events) but leaves several orphan references intact. These surface as dangling IDs in arrays, stale UI selections, and merge-imported artifacts pointing to non-existent runs.

**Orphan sites identified**

1. **`SearchFeedbackEvent.relatedRunIds[]`** (src/types/search.ts:310-313) — when *other* runs are deleted, surviving feedback events still reference the dead run IDs in this array. No sweep.

2. **`ThesisRevisionHistoryEntry.triggeredByFeedbackIds[]`** (src/types/search.ts:152) — when feedback events cascade-delete with their run, revision history on *other* narratives still lists the now-deleted feedback IDs.

3. **`uiStore.selectedRunIdByRequestId[requestId]`** (src/store/uiStore.ts:273) — `deleteRun` in searchStore.ts does not cross-store clear the UI's selected run when the selected run is the one being deleted. UI points at a dead ID until the user re-selects. `deleteRequest` handles it; `deleteRun` does not.

4. **Workspace import merge** (src/persistence/workspaceImportMerge.ts) — the merge path does not validate that `pipelineMaps[runId]`, `narratives[runId]`, or `feedbackEvents[*].runId` reference a run that survived the merge. An imported workspace containing a map/narrative for a dropped run lands as an orphan.

**Proposed solution**

Add a single `pruneOrphans(state)` helper in searchStore.ts that:

- Given the post-mutation state, computes the valid set of runIds and requestIds
- Filters `relatedRunIds` arrays to surviving IDs (removes empty events if all references dropped? configurable — probably keep the event with an empty array since it carries its own content)
- Filters `triggeredByFeedbackIds` arrays to surviving feedback IDs
- Clears `selectedRunIdByRequestId[r]` when the selected run no longer exists (requires cross-store call or a subscription — easier: emit an event that uiStore listens for)
- Drops orphaned pipelineMaps and narratives whose runId doesn't resolve

Invoke `pruneOrphans` at the end of `deleteRun`, `deleteRequest`, and after `mergeWorkspaceData`.

**Scope tradeoffs**

Cross-store coordination (item 3) is the messiest piece. Options:
- A: uiStore subscribes to searchStore changes and reconciles on its own
- B: searchStore exports a `getLiveRunIds()` accessor; uiStore calls it on every selector read and defensively returns undefined if the selection is stale
- C: A top-level orchestrator function that updates both stores atomically

B is simplest and defers the cleanup to read-time rather than write-time — tolerable for a UI state field. A is cleanest long-term but adds store coupling. Pick one during implementation.

**Tests to add**

- Delete a run; verify other feedback events' `relatedRunIds` no longer contain the deleted runId
- Delete a feedback event (via cascading run delete); verify other narratives' `triggeredByFeedbackIds` no longer contain the deleted feedbackId
- Delete the currently-selected run; verify uiStore's selectedRunIdByRequestId is cleared (or read returns undefined, per chosen approach)
- Merge import containing a pipelineMap whose runId doesn't exist in the merged state; verify the map is dropped
- Merge import containing a narrative whose runId doesn't exist; verify the narrative is dropped

**Non-goals**

- Do not add referential integrity at the type level (foreign-key-style typing); runtime sweep is sufficient
- Do not retroactively fix existing persisted snapshots — `migrateSearchState` should call `pruneOrphans` once on hydration so the cleanup is idempotent
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 pruneOrphans helper implemented in src/store/searchStore.ts
- [ ] #2 deleteRun invokes pruneOrphans and leaves no dangling relatedRunIds or triggeredByFeedbackIds
- [ ] #3 deleteRequest invokes pruneOrphans (already cascades; extends to the new sites)
- [ ] #4 mergeWorkspaceData in workspaceImportMerge.ts drops pipelineMaps/narratives/feedbackEvents referencing runIds that didn't survive the merge
- [ ] #5 uiStore.selectedRunIdByRequestId cleared when the selected run is deleted (approach documented — subscribe vs read-time reconcile)
- [ ] #6 migrateSearchState calls pruneOrphans on hydration so legacy orphans clean up once
- [ ] #7 Regression tests cover all four orphan sites (relatedRunIds, triggeredByFeedbackIds, selectedRunIdByRequestId, import-merge-orphans)
- [ ] #8 Existing cascade-delete tests still pass
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
