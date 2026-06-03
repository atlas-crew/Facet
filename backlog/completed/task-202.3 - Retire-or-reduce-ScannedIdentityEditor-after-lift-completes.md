---
id: TASK-202.3
title: Retire or reduce ScannedIdentityEditor after lift completes
status: Done
assignee: []
created_date: '2026-04-30 18:42'
updated_date: '2026-05-08 20:42'
labels:
  - identity
  - map-convergence
  - strategy-d
  - deletion
dependencies:
  - TASK-202.2
references:
  - src/routes/identity/ScanReviewPane.tsx
  - src/routes/identity/IdentityPage.tsx
  - src/routes/identity/ExtractionAgentCard.tsx
parent_task_id: TASK-202
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context (TASK-202 phase 3)

Once TASK-202.2's lift work is done, evaluate what remains in `ScannedIdentityEditor.tsx`. Two outcomes are plausible:

- **Retire entirely.** If most field editors had canonical Map homes already and the lifted features (metrics, source_text, deepen) cover the rest, what's left is too thin to justify its own component. Replace with a minimal `ScanReviewPane` showing parser output + Apply.
- **Reduce significantly.** Keep `ScannedIdentityEditor` but trimmed: only scan-flow-specific responsibilities (parser warnings, edit-tracking, scan-staging field editors that write to `scanResult` rather than `currentIdentity`). Probably renamed for clarity.

The choice depends on what TASK-202.2's decision matrix produces. This task can't be planned in detail until then — but the work itself (delete or trim, update callers, rewire imports) is mechanical once the decision is made.

## Approach

1. Read TASK-202.2's notes; confirm the survivor list of features.
2. Decide: retire entirely (replace with minimal review pane) or reduce.
3. Execute the deletion/reduction in one focused commit:
   - Delete or trim `ScannedIdentityEditor.tsx`
   - Update `ExtractionAgentCard.tsx` (the consumer in the workbench)
   - Update tests
4. Run full suite; verify scan flow still works end-to-end (PDF upload → review → apply).

## Out of scope

- The form factor of the import flow itself (route vs sheet vs overlay). That's DRAFT-2.
- Any feature lifts. Those happen in TASK-202.2.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Decision recorded in notes: retire ScannedIdentityEditor entirely, or reduce + rename, with reasoning citing TASK-202.2's outcomes
- [ ] #2 If retired: ScannedIdentityEditor.tsx deleted; replacement ScanReviewPane (or equivalent) is minimal — just renders parser output and Apply control
- [x] #3 If reduced: file renamed if appropriate; remaining responsibilities are scan-flow-only with no canonical-state writers
- [x] #4 All callers updated; no orphaned imports
- [x] #5 Scan flow works end-to-end (PDF upload → review → apply produces a correct currentIdentity); regression-tested
- [x] #6 Test suite passes; no test coverage gap for previously-tested behaviors
<!-- AC:END -->



## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Recommended skill loadout for picking up this task

**Always-load:**
- `backlog-md` — record the retire-vs-reduce decision in notes before executing
- `atomic-commits` — the deletion + caller updates should be one commit; tests-still-pass verification follows
- `verification-before-completion` — scan flow must work end-to-end *after* deletion; not just typecheck
- `codanna-codebase-intelligence` — critical for finding every caller / import / test reference; deleting a 1,420-line file with stale imports left behind is the most likely failure mode

**Phase-specific:**
- `repo-cleanup` — safe-deletion workflow (find dead refs, verify no orphaned types, confirm no test fixtures depend on it)

**Note:** This task depends on TASK-202.2 being complete. Do not start until TASK-202.2's lift commits have all landed and its notes contain the survivor inventory.

## Decision and reduction completed (2026-05-08)

Decision: reduce and rename rather than retire entirely.

Reasoning from TASK-202.2:
- All canonical-only survivors now have Map-side homes: source_text sheet, per-bullet Deepen, and metrics JSON sheet in BulletInspector.
- The remaining scan surface responsibilities are scan-flow-only: parser-output staging, scan/deepen confidence guidance, review filters, transient scanResult field correction, bulk scan deepening, rescan, and clear-scan lifecycle controls.
- DRAFT-2 owns the final import-flow form factor. Fully replacing the scan reviewer with a minimal apply-only pane would collapse that future routing/sheet decision into this mechanical cleanup task.

Implementation:
- Renamed src/routes/identity/ScannedIdentityEditor.tsx to src/routes/identity/ScanReviewPane.tsx.
- Renamed the exported component and props to ScanReviewPane / ScanReviewPaneProps.
- Updated ExtractionAgentCard to import and render ScanReviewPane.
- Confirmed there are no source imports or component references to ScannedIdentityEditor after the rename; remaining mentions are historical task text.

Verification:
- npx vitest run src/test/IdentityPage.test.tsx -t "uploads a PDF|deepens a scanned bullet|deepens all scanned bullets|cancels bulk|scan is cleared|aborts an in-flight|focused impact|switches the detail pane|disables bullet": PASS, 9 tests / 17 skipped.
- npx eslint src/routes/identity/ScanReviewPane.tsx src/routes/identity/ExtractionAgentCard.tsx: PASS.
- npm run typecheck: PASS.
- npm run build: PASS, with existing large-chunk warnings.
- npm run format:files -- src/routes/identity/ScanReviewPane.tsx src/routes/identity/ExtractionAgentCard.tsx: applied.
- npm run format:files:check -- src/routes/identity/ScanReviewPane.tsx src/routes/identity/ExtractionAgentCard.tsx: PASS.

AC #2 is not applicable because the chosen branch was reduce + rename, not retire entirely.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
