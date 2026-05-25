---
id: TASK-248
title: Wire or remove searchStore.deleteRun
status: Done
assignee:
  - '@codex'
created_date: '2026-05-10 08:13'
updated_date: '2026-05-25 14:53'
labels:
  - audit-finding
  - wiring-cleanup
  - research
  - searchStore
milestone: m-30
dependencies: []
references:
  - docs/audits/2026-05-10/report.md
  - 'src/store/searchStore.ts:881'
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Audit context (W-3)

`searchStore.deleteRun` is exported with cascade-delete semantics (also clears feedback events tied to the run) but has no production consumer. Audit at `docs/audits/2026-05-10/report.md` flagged as `unwired-capability` / severity `gap`.

**Backend side:** `src/store/searchStore.ts:881` (impl), `:133` (type decl). The implementation includes a doc comment about its cascade role: *"deleteRequest's cascade: stale events would otherwise be returned by [...]"*.

**Absence evidence:**

```
$ grep -rn "deleteRun" src/
src/store/searchStore.ts:133,881
src/test/searchStore.test.ts:575,1587   # tests only
```

## Product question

Each `SearchRun` record is one executed deep-research job. They accumulate over time. Do users need to delete individual runs, or are runs effectively immutable history?

## Pairing

Tied to **W-2 `deleteRequest`**. If we ship delete-request UI we get delete-run UI for free (the cascade handles it). If we declare runs append-only, we should declare requests append-only too — otherwise a user could delete a request whose runs persist orphaned.

Decide W-2 and W-3 together.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Decision recorded: wire or remove, paired with W-2's decision
- [ ] #2 If wire: UI affordance exists for individual run deletion (or covered by W-2's request-cascade)
- [ ] #3 If wire: test covers feedback-event cleanup
- [x] #4 If remove: type decl, impl, and tests deleted; the cascade comment at searchStore.ts:883 either preserved (if deleteRequest stays) or cleaned up
- [x] #5 Audit finding W-3 updated to resolved
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-05-25 Codex starting searchStore cleanup cluster. Decision path: remove unwired APIs rather than build UI affordances; saved search requests/runs remain append-only durable history until a product surface explicitly needs editing/deletion/drill-down. Plan: remove store type declarations and implementations, delete test-only coverage for those APIs, update the 2026-05-10 audit report and capability registry, run focused searchStore tests plus typecheck/lint/format, independent review, commit with cortex git commit, then close TASK-248 with receipts.

Completed searchStore unwired API cleanup cluster.

Decision: remove path. Saved search requests/runs are append-only durable history; refinements create new records, and orphan cleanup remains at hydration/import boundaries via pruneOrphans.

Receipts:
- pnpm exec vitest run src/test/searchStore.test.ts: PASS (39 tests)
- pnpm exec eslint src/store/searchStore.ts src/test/searchStore.test.ts: PASS
- pnpm exec prettier --check --ignore-unknown src/store/searchStore.ts src/test/searchStore.test.ts docs/audits/2026-05-10/report.md: PASS
- pnpm run typecheck: PASS
- git diff --check: PASS
- src grep for removed APIs: PASS (no updateRequest/deleteRequest/deleteRun/getRunsForRequest/getFeedbackEventsForRun refs in src)
- Independent Claude full-context review: PASS WITH ISSUES; doc-only issues remediated (.agents/reviews/review-20260525-104617-claude-full-searchstore.md)
- Independent Gemini follow-up review: CLEAN (.agents/reviews/review-20260525-105119-gemini-followup-searchstore.md)

Implementation:
- Removed unwired searchStore declarations/implementations and test-only callers.
- Added interface-level append-only history note for requests/runs.
- Updated 2026-05-10 audit report dispositions and pruned stale capability registry entries.
- Existing migration/import orphan-pruning coverage remains in searchStore/workspace backup tests.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed the unwired searchStore API for TASK-248 via the append-only search history decision, updated test coverage/docs, and verified with focused tests, lint, typecheck, grep, and independent review.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 Automatic formatting was applied to touched files
- [x] #4 Regression tests pass (scoped to touched files)
- [x] #5 Linters report no warnings or errors in touched files
- [x] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
