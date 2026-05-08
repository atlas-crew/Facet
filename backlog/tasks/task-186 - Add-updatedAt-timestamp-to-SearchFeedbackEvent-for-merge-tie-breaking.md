---
id: TASK-186
title: Add updatedAt timestamp to SearchFeedbackEvent for merge tie-breaking
status: Done
assignee:
  - '@codex'
created_date: '2026-04-20 06:37'
updated_date: '2026-05-08 04:49'
labels:
  - search-redesign
  - types
  - feedback
  - 'origin:ai-review'
  - remediation
milestone: m-20
dependencies:
  - TASK-163
references:
  - src/types/search.ts
  - src/store/searchStore.ts
  - src/persistence/workspaceImportMerge.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up from the TASK-163 codex review loop (cycle 3 P2 finding).

The current `mergeSearchFeedbackEvents` merger cannot correctly resolve `reflectedInThesisId` conflicts when both the local and imported copies have a value. Cycle 2 used "prefer local (non-regressing)" — codex cycle 3 flagged this regresses on *newer* backup imports where imported's thesis id is more current. Cycle 1 used the opposite rule — cycle 2 flagged *that* regresses on older imports.

The oscillation exposes a root cause: the type doesn't carry enough information to distinguish "older" from "newer" copies of the same event. Solution:

**Schema extension (src/types/search.ts):**
- Add `updatedAt?: string` to `SearchFeedbackEvent` — ISO timestamp of the most recent mutation (`addFeedbackEvent`, `markFeedbackApplied`, or `markFeedbackReflectedInThesis`). Initially optional for backward compatibility with snapshots written before this ships.

**Store changes (src/store/searchStore.ts):**
- `addFeedbackEvent` sets `updatedAt = createdAt` on creation.
- `markFeedbackApplied` sets `updatedAt = now()` alongside `appliedToIdentity` / `appliedAtVersion`.
- `markFeedbackReflectedInThesis` sets `updatedAt = now()` alongside `reflectedInThesisId`.

**Merge rule update (src/persistence/workspaceImportMerge.ts):**
- `mergeFeedbackEventState`: when both copies have `updatedAt`, prefer the event with the later timestamp for mutable fields (`reflectedInThesisId`, `appliedToIdentity`, `appliedAtVersion`). Fall back to the current non-regressing rules when timestamps are absent or equal.

**Migration:**
- Persisted events without `updatedAt` continue to merge via the current non-regressing rules. New mutations set `updatedAt`. No backward-incompatible change.

**Tests to add:**
- merge where imported.updatedAt > local.updatedAt → imported's `reflectedInThesisId` wins
- merge where local.updatedAt > imported.updatedAt → local wins
- merge where timestamps missing → falls back to non-regressing rule
- `markFeedbackApplied` and `markFeedbackReflectedInThesis` set `updatedAt`
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 SearchFeedbackEvent has optional updatedAt: string field
- [x] #2 addFeedbackEvent sets updatedAt = createdAt on creation
- [x] #3 markFeedbackApplied updates updatedAt to current time
- [x] #4 markFeedbackReflectedInThesis updates updatedAt to current time
- [x] #5 mergeFeedbackEventState prefers the event with later updatedAt for mutable fields when both have timestamps
- [x] #6 Falls back to non-regressing merge rule when timestamps are missing or equal
- [x] #7 Backward compatible — persisted events without updatedAt still merge correctly
- [x] #8 Tests cover both directions of the timestamp comparison plus the fallback path
- [x] #9 mergeFeedbackEventState uses Math.max(local.appliedAtVersion, imported.appliedAtVersion) when both sides are defined AND timestamps are absent or equal — nullish coalescing silently loses the higher value when local was already applied to a lower thesis version and imported was applied to a higher one
- [x] #10 Test covers the both-defined, no-timestamp fallback path with distinct appliedAtVersion values
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Add updatedAt to SearchFeedbackEvent and mutation sites, update workspace import merge to prefer later updatedAt for mutable feedback fields while preserving non-regressing fallback behavior, cover store mutation timestamps and merge timestamp/fallback cases with focused tests, then commit TASK-186 files only.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-04-20: Multi-specialist review surfaced a related bug in the fallback path. Beyond the timestamp-driven merge rule this task already covers, the current `local.appliedAtVersion ?? imported.appliedAtVersion` silently picks local when both are defined. That's wrong — monotonic progress counters should take Math.max. Scope extended to cover this edge case so the non-regressing fallback is actually non-regressing even without updatedAt.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented optional SearchFeedbackEvent.updatedAt with store-created timestamps, mutation timestamp updates, and timestamp-aware workspace import merge conflict resolution. When both copies have comparable updatedAt values, mutable feedback progress fields come from the newer copy; missing/equal timestamps keep the legacy non-regressing fallback, including Math.max for both-defined appliedAtVersion.

Verification:
- npm run format:files -- src/types/search.ts src/store/searchStore.ts src/persistence/workspaceImportMerge.ts src/test/searchStore.test.ts src/test/workspaceBackup.test.ts "backlog/tasks/task-186 - Add-updatedAt-timestamp-to-SearchFeedbackEvent-for-merge-tie-breaking.md" (pass)
- npx vitest run src/test/searchStore.test.ts src/test/workspaceBackup.test.ts (pass: 59 tests)
- npm run typecheck (pass)
- npx eslint src/types/search.ts src/store/searchStore.ts src/persistence/workspaceImportMerge.ts src/test/searchStore.test.ts src/test/workspaceBackup.test.ts (pass)
- npm run build (pass)
- npm run lint (fails on existing/generated and unrelated files: .vercel/output, dist-unmin-*, src/hooks/useElapsed.ts, src/routes/identity/inspectorSlots/slotPrimitives.tsx, src/routes/prep/PrepCardView.tsx, tests/hosted/*; no touched-file findings)
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
