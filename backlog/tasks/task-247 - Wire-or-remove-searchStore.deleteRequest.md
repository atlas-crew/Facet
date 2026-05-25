---
id: TASK-247
title: Wire or remove searchStore.deleteRequest
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
  - 'src/store/searchStore.ts:825'
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Audit context (W-2)

`searchStore.deleteRequest` is exported but has no production consumer. The wiring audit at `docs/audits/2026-05-10/report.md` flagged it as `unwired-capability` / severity `gap`.

**Backend side:** `src/store/searchStore.ts:825` (impl), `:130` (type decl).

**Absence evidence:**

```
$ grep -rn "deleteRequest" src/
src/store/searchStore.ts:130    # type decl
src/store/searchStore.ts:825    # impl
src/test/searchStore.test.ts:224,283,1661   # tests only
```

The implementation has cascade semantics — deleting a request also nulls out child runs and feedback events tied to it. That's careful work that's only exercised by tests today.

## Product question

Are saved search requests **append-only by design**, or should users be able to remove them? Current behavior: a user accumulates `SearchRequest` records (one per "save this search") indefinitely with no way to clean up.

If append-only is intentional → remove `deleteRequest` (and pair with W-3's `deleteRun` removal since the cascade is shared).

If users should be able to delete saved requests → wire a delete affordance on the saved-searches surface (likely a row-level button or a per-request menu in the research workspace).

## Pairing

- **W-3 `deleteRun`** is the natural sibling. The cascade in `deleteRequest` clears feedback events; `deleteRun` has its own cascade. If we ship one, we should ship both. If we remove one, we can remove both together.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Decision recorded: wire or remove, with one-sentence rationale referencing the product call
- [ ] #2 If wire: UI affordance exists on the saved-searches surface and invokes deleteRequest with confirmation
- [ ] #3 If wire: integration test covers the delete flow including cascade to runs/feedback
- [x] #4 If remove: type decl, impl, and tests deleted; cascade behavior in surrounding code verified intact for any remaining callers
- [x] #5 Audit finding W-2 in docs/audits/2026-05-10/report.md updated to resolved with the resolution path
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-05-25 Codex starting searchStore cleanup cluster. Decision path: remove unwired APIs rather than build UI affordances; saved search requests/runs remain append-only durable history until a product surface explicitly needs editing/deletion/drill-down. Plan: remove store type declarations and implementations, delete test-only coverage for those APIs, update the 2026-05-10 audit report and capability registry, run focused searchStore tests plus typecheck/lint/format, independent review, commit with cortex git commit, then close TASK-247 with receipts.

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
Removed the unwired searchStore API for TASK-247 via the append-only search history decision, updated test coverage/docs, and verified with focused tests, lint, typecheck, grep, and independent review.
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
