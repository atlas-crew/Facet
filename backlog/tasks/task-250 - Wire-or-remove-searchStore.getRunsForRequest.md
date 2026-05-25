---
id: TASK-250
title: Wire or remove searchStore.getRunsForRequest
status: In Progress
assignee:
  - '@codex'
created_date: '2026-05-10 08:13'
updated_date: '2026-05-25 14:40'
labels:
  - audit-finding
  - wiring-cleanup
  - research
  - searchStore
milestone: m-30
dependencies: []
references:
  - docs/audits/2026-05-10/report.md
  - 'src/store/searchStore.ts:894'
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Audit context (W-5)

`searchStore.getRunsForRequest(requestId): SearchRun[]` is a read selector that filters runs by request. No UI consumes it. Audit at `docs/audits/2026-05-10/report.md` flagged as `unwired-capability` / severity `gap`.

**Backend side:** `src/store/searchStore.ts:894` (impl, one-line filter), `:134` (type decl).

**Absence evidence:**

```
$ grep -rn "getRunsForRequest" src/
src/store/searchStore.ts:134,894
src/test/searchStore.test.ts:277   # test only
```

## Product question

The selector enables an "all runs for this saved request" drill-down view (e.g., a sidebar that shows the run history for the currently-selected request, with status, timestamps, results count). Is that view planned?

If planned → wire it. The selector is one line; the cost is the UI work, not the wire.

If not planned → remove `getRunsForRequest`. Cheap removal (1 line in store, 1 line in test).

## Pairing

**W-6 `getFeedbackEventsForRun`** is the natural sibling. Both feed a "drill-down on a saved search/run" view. If we build the drill-down, we wire both. If we don't, we remove both.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Decision recorded: wire (drill-down view) or remove
- [ ] #2 If wire: UI surface renders runs grouped under their request with status / time / result count
- [ ] #3 If wire: test covers the selector behavior in the consuming view
- [ ] #4 If remove: type decl, impl, and test deleted
- [ ] #5 Audit finding W-5 updated to resolved
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-05-25 Codex starting searchStore cleanup cluster. Decision path: remove unwired APIs rather than build UI affordances; saved search requests/runs remain append-only durable history until a product surface explicitly needs editing/deletion/drill-down. Plan: remove store type declarations and implementations, delete test-only coverage for those APIs, update the 2026-05-10 audit report and capability registry, run focused searchStore tests plus typecheck/lint/format, independent review, commit with cortex git commit, then close TASK-250 with receipts.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Regression tests pass (scoped to touched files)
- [ ] #5 Linters report no warnings or errors in touched files
- [ ] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
