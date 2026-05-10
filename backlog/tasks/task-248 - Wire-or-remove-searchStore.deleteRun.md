---
id: TASK-248
title: Wire or remove searchStore.deleteRun
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
- [ ] #1 Decision recorded: wire or remove, paired with W-2's decision
- [ ] #2 If wire: UI affordance exists for individual run deletion (or covered by W-2's request-cascade)
- [ ] #3 If wire: test covers feedback-event cleanup
- [ ] #4 If remove: type decl, impl, and tests deleted; the cascade comment at searchStore.ts:883 either preserved (if deleteRequest stays) or cleaned up
- [ ] #5 Audit finding W-3 updated to resolved
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
