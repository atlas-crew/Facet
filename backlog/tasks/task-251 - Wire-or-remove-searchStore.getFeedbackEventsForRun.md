---
id: TASK-251
title: Wire or remove searchStore.getFeedbackEventsForRun
status: In Progress
assignee:
  - '@codex'
created_date: '2026-05-10 08:14'
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
  - 'src/store/searchStore.ts:1095'
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Audit context (W-6)

`searchStore.getFeedbackEventsForRun(runId): SearchFeedbackEvent[]` is a read selector that filters feedback events by run. No UI consumes it. Audit at `docs/audits/2026-05-10/report.md` flagged as `unwired-capability` / severity `gap`.

**Backend side:** `src/store/searchStore.ts:1095` (impl, one-line filter), `:166` (type decl).

**Absence evidence:**

```
$ grep -rn "getFeedbackEventsForRun" src/
src/store/searchStore.ts:166,1095
src/test/searchStore.test.ts:1494,1504   # test only
```

## Product question

The selector enables a per-run feedback display (e.g., "for this run, here are the assumption-corrections, avoid-additions, and other feedback the user submitted while reviewing results"). Is that view planned?

If planned → wire it. Likely lives alongside W-5's per-request drill-down.

If not planned → remove. Cheap.

## Pairing

**W-5 `getRunsForRequest`** is the natural sibling. Both feed a drill-down view that doesn't currently exist. Decide W-5 and W-6 together.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Decision recorded: wire (per-run feedback display) or remove, paired with W-5
- [ ] #2 If wire: UI surface renders feedback events grouped by run with type / target / appliedToIdentity status
- [ ] #3 If wire: test covers the selector behavior in the consuming view
- [ ] #4 If remove: type decl, impl, and test deleted
- [ ] #5 Audit finding W-6 updated to resolved
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-05-25 Codex starting searchStore cleanup cluster. Decision path: remove unwired APIs rather than build UI affordances; saved search requests/runs remain append-only durable history until a product surface explicitly needs editing/deletion/drill-down. Plan: remove store type declarations and implementations, delete test-only coverage for those APIs, update the 2026-05-10 audit report and capability registry, run focused searchStore tests plus typecheck/lint/format, independent review, commit with cortex git commit, then close TASK-251 with receipts.
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
