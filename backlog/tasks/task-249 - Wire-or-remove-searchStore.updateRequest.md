---
id: TASK-249
title: Wire or remove searchStore.updateRequest
status: To Do
assignee: []
created_date: '2026-05-10 08:13'
labels:
  - audit-finding
  - wiring-cleanup
  - research
  - searchStore
milestone: m-30
dependencies: []
references:
  - docs/audits/2026-05-10/report.md
  - 'src/store/searchStore.ts:810'
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Audit context (W-4)

`searchStore.updateRequest(id, patch: Partial<SearchRequest>)` lets a saved request be edited in place but no UI calls it. Audit at `docs/audits/2026-05-10/report.md` flagged as `unwired-capability` / severity `gap`.

**Backend side:** `src/store/searchStore.ts:810` (impl), `:129` (type decl).

**Absence evidence:**

```
$ grep -rn "updateRequest" src/
src/store/searchStore.ts:129,810
src/test/searchStore.test.ts:202   # test only
```

## Product question

Are saved `SearchRequest` records **immutable once created**, or should users be able to edit them in place? Current effective behavior is "create a new request to change anything," which produces request churn — every refinement creates a new row.

If immutable by design → remove `updateRequest`.

If editable → wire an edit affordance on the saved-searches surface. Note this is independent of W-2/W-3 (delete is a different concern); W-4 can be decided on its own.

## Considerations

- The `SearchRequest` shape includes `customKeywords`, `excludeCompanies`, `maxResults`, `salaryAnchorOverride` — fields a user might reasonably refine over time without wanting a new row.
- If editable: edit-vs-revision question (does editing replace in place, or fork into a new record? The current `updateRequest` does in-place, which is one design choice).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Decision recorded: wire (in-place edit), wire (revision/fork), or remove
- [ ] #2 If wire: UI affordance exists with appropriate confirmation; preserve durableMeta revision tracking
- [ ] #3 If wire: test covers update flow and any cascade effects on child runs
- [ ] #4 If remove: type decl, impl, and test deleted
- [ ] #5 Audit finding W-4 updated to resolved
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Regression tests pass (scoped to touched files)
- [ ] #5 Linters report no warnings or errors in touched files
- [ ] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
