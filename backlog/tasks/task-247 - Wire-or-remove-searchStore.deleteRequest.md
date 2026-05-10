---
id: TASK-247
title: Wire or remove searchStore.deleteRequest
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
- [ ] #1 Decision recorded: wire or remove, with one-sentence rationale referencing the product call
- [ ] #2 If wire: UI affordance exists on the saved-searches surface and invokes deleteRequest with confirmation
- [ ] #3 If wire: integration test covers the delete flow including cascade to runs/feedback
- [ ] #4 If remove: type decl, impl, and tests deleted; cascade behavior in surrounding code verified intact for any remaining callers
- [ ] #5 Audit finding W-2 in docs/audits/2026-05-10/report.md updated to resolved with the resolution path
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
