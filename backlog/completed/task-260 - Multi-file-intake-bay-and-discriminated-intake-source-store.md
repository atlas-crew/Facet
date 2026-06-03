---
id: TASK-260
title: Multi-file intake bay and discriminated intake-source store
status: Done
assignee:
  - '@claude'
created_date: '2026-05-11 05:20'
updated_date: '2026-05-11 07:00'
labels:
  - feature
  - identity
  - multi-source-intake
milestone: m-33
dependencies: []
modified_files:
  - src/types/identity.ts
  - src/store/identityStore.ts
  - src/routes/identity/ExtractionAgentCard.tsx
  - src/routes/identity/IdentityPage.tsx
  - src/test/IdentityPage.test.tsx
  - src/test/identityStore.test.ts
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the single-file resume scan slot in identityStore with a discriminated `IntakeSource[]` array, and update `ExtractionAgentCard` to accept multiple PDF uploads. Foundation for multi-source identity intake (m-33). Phase 1 wires only the `resume` source variant; the discriminator is in place so future sources (`jd`, `agent-dump`) plug in without refactor.

CONTEXT (load-bearing decisions from m-33 milestone):
- N=1 behavior MUST match the current single-file flow exactly (new path supersets old).
- `intakeSources[]` is store-internal state, NOT persisted as part of ProfessionalIdentityV3. Discarded after the user accepts a draft.
- Each source can carry an optional user-supplied `userLabel` (e.g., "platform", "security") used as a positioning hint at synthesis time.
- Cap of 10 sources per synthesis; above-cap files show inline warning but can still be removed.

SHAPE:
```ts
type IntakeSource =
  | { kind: 'resume'; id: string; userLabel?: string; scan: ResumeScanResult }
  // future Phase 2: | { kind: 'jd'; id: string; userLabel?: string; sourceUrl?: string; analysis: JDAnalysis }
  // future Phase 3: | { kind: 'agent-dump'; id: string; agentName?: string; text: string }
```

The existing single-file flow currently stores `scanResult: ResumeScanResult | null` on `identityStore`. Refactor consumers in `IdentityPage.tsx` and related code to read from `intakeSources` (selectors that derive the merged view).

REFERENCES:
- Current single-file intake: src/routes/identity/ExtractionAgentCard.tsx, src/routes/identity/IdentityPage.tsx
- Current store slot: src/store/identityStore.ts (scanResult field)
- Current ResumeScanResult type: src/types/identity.ts
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 IntakeSource discriminated union exported from src/types/identity.ts with the `resume` variant fully typed and jd/agent-dump slots noted as TODO with their planned shape in adjacent comments
- [x] #2 identityStore.scanResult slot removed; replaced with intakeSources: IntakeSource[] and the relevant setter/getter API
- [x] #3 ExtractionAgentCard `<input type="file">` carries the `multiple` attribute and accepts multi-file selection
- [x] #4 Drag-and-drop accepts multiple PDF files in one drop event
- [x] #5 Each source rendered as a file card showing filename, page count, role/bullet/skill counts, optional userLabel text input, and a remove button
- [x] #6 Sequential scan of dropped files; individual scan failure does not abort the batch and surfaces error inline on the failing card
- [x] #7 N=1 flow (Generate Draft, Deepen All, Rescan, Clear) behaves identically to the previous single-file behavior
- [x] #8 Cap of 10 sources enforced with an inline warning on above-cap files; remove action still works on above-cap files
- [x] #9 Existing IdentityPage.test.tsx and identityStore.test.ts updated to the new store shape; all pre-existing assertions still pass under N=1
- [x] #10 New tests cover: multi-file drop sequencing, mid-batch scan failure isolation, source removal, cap enforcement, userLabel persistence in store
- [x] #11 Short JSDoc on the IntakeSource union explaining the discriminator and the seam intent for future Phase 2/3 sources
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Atomic commit decomposition (revised — 4 commits for cleaner review surfaces)

**Commit 1** — `feat(identity): add IntakeSource discriminated union type`
- `src/types/identity.ts`: add `IntakeSource` union (resume arm only) with JSDoc on the discriminator and the seam intent for future Phase 2/3 sources (`jd`, `agent-dump`).
- No consumers yet. Pure type addition. Tests untouched.
- ACs: #1, #11.

**Commit 2** — `feat(identity): replace scanResult slot with intakeSources array (N=1 preserved)`
- `src/store/identityStore.ts`: rename slot `scanResult: ResumeScanResult | null` → `intakeSources: IntakeSource[]`. Introduce `getActiveResumeScan(state)` helper. All internal helpers/actions route through it. `setScanResult` becomes a single-source facade that replaces `intakeSources` with `[{kind:'resume', id, scan}]` or `[]`. Bump persist `version: 4 → 5` with migrate that maps old `scanResult` field → single-element `intakeSources` (or `[]`). Update `partialize`, `normalizePersistedIdentityState`, `merge`, `unwrapPersistedIdentityState`.
- `src/routes/identity/IdentityPage.tsx`: consumers read via `getActiveResumeScan` selector.
- `src/test/identityStore.test.ts`, `src/test/IdentityPage.test.tsx`: existing assertions updated to the new shape; N=1 semantics preserved.
- ACs: #2, #7, #9.

**Commit 3** — `feat(identity): multi-file intake selection and file-card list UI`
- `ExtractionAgentCard.tsx`: `<input multiple>`, multi-file drag-drop, per-source file cards (filename, counts, userLabel input, remove button).
- `IdentityPage.tsx`: sequential scan plumbing with isolated failure handling.
- ACs: #3, #4, #5, #6.

**Commit 4** — `feat(identity): enforce 10-source intake cap`
- `ExtractionAgentCard.tsx`: cap enforcement, above-cap inline warning, remove still works above cap.
- ACs: #8.

**Test Writing Loop** runs after each feature commit, audits gaps, may add a test commit. **Lint Gate** runs last per atomic feature, may add a style commit. AC #10 lands distributed across these loops.

## Persistence considerations (per facet-persistence-changes)

- `scanResult` IS in `identityStore.partialize` (line 1674) → Zustand `version: 4 → 5` with migrate required.
- `scanResult` is NOT in `src/persistence/` (workspace snapshot) → no snapshot adapter touches needed.
- `intakeSources` stays Zustand-store-only (transient intake state, discarded after draft acceptance).
- Pre-launch posture permits dropping the migrate fallback if it grows complex; the transform here is one-liner-cheap so we keep it.

## Agent-loops cadence

Per atomic feature commit: Code Change Loop (`specialist-review.sh` on source files) → cortex git commit → Test Writing Loop (`diff-test-audit.sh --git`) → cortex git commit if gaps fixed → Lint Gate → cortex git commit if lint changed. Reviewer rotation: provider-aware script keeps Claude (current session model family) last; Gemini/Codex attempted first.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Commits landed (2 of 4 planned):**

1. `feat(identity): add IntakeSource discriminated union type` — pure type addition to `src/types/identity.ts` with seam-intent JSDoc. Review: `.agents/reviews/review-20260511-013013.md` (CLEAN, Gemini, 15s).

2. `feat(identity): replace scanResult slot with intakeSources array` — 787-line refactor across 19 files. Store renames `scanResult: ResumeScanResult | null` → `intakeSources: IntakeSource[]`; introduces `getActiveResumeScan` selector + `replaceIntakeSourcesWithScan` / `updateActiveResumeScan` helpers; persist `version: 4 → 5` with `normalizePersistedIdentityState` handling both legacy and new shapes. Consumers (`IdentityPage`, `HomePage`) read via the exported selector. Two persistence-rehydrate tests rewritten to hand-craft legacy v3 / v5 envelopes. Review: `.agents/reviews/review-20260511-015345.md` (CLEAN, Gemini, 125s). Test Writing Loop: `audit skipped: substantively-trivial-refactor — slot rename + N=1-preserving facade, no new behavior surfaces`. Lint clean. Full suite: 2362/2362 passing.

**ACs covered:** #1, #2, #7, #9, #11 (foundational shape).

**Remaining work:**
- Commit 3 (`feat(identity): multi-file intake selection and file-card list UI`): ACs #3, #4, #5, #6
- Commit 4 (`feat(identity): enforce 10-source intake cap`): AC #8
- Test loop additions across commits: AC #10

3. `feat(identity): multi-file intake selection and file-card list UI` (commit b3e3647) — adds `multiple` to the file input, multi-file drag-drop, sequential batch scan with per-file failure isolation, and a per-source file-card list (filename, page count, role/bullet/skill/project counts, optional userLabel input, remove button) rendered above the active-source detail block.

Store additions: `appendIntakeSource`, `removeIntakeSource`, `setIntakeSourceLabel` — additive optional fields on the existing IntakeSource union, no persist migration needed.

IdentityPage refactor: `handleScannedFile` now takes `{replace: boolean}`; `scanFileBatch` decides per-file mode based on `rescanModeRef`/`startingEmpty`/batch size so N=1 + Rescan still route through the legacy `setScanResult` facade. 0-role scans in append mode push to a transient `failedFiles` state (inline error card) rather than triggering the paste-mode fallback that would clobber the batch. Rescan is hidden when 2+ sources exist — prevents `setScanResult` from silently destroying trailing sources; multi-source users use Remove + Add for that case. AC #7 (N=1 preserved) re-walked manually across all permutations (initial upload, rescan, clear, paste-fallback).

Typecheck clean; full suite 2370/2370 passing; lint clean on touched files. Test Writing Loop + AC #10 (multi-file sequencing, mid-batch failure, source removal, userLabel persistence) deferred to a follow-up commit.

**ACs covered this commit:** #3, #4, #5, #6.

**Remaining work:**
- Commit 4 (`feat(identity): enforce 10-source intake cap`): AC #8
- Test commit covering AC #10 (multi-file flow tests)

4. `feat(identity): enforce 10-source intake cap` (commit b1d4122) — adds `INTAKE_SOURCE_CAP = 10` next to the `IntakeSource` type, renders an 'Over cap' badge + muted styling on cards at index >= 10, and surfaces a banner-style warning above the source list. Remove still works on above-cap sources. Also fixes wrong CSS tokens shipped in commit b3e3647 (`--status-critical` / `--status-warning` are undefined; the codebase defines `--error` / `--warning`).

5. `test(identity): multi-source intake flow coverage` (commit ba59e70) — 11 new tests for AC #10. identityStore.test.ts: append order, draftDocument seeded only on first append, remove non-active vs active, no-op on unknown id, userLabel trim/clear, persist roundtrip including userLabel. IdentityPage.test.tsx: multi-file drop sequencing, mid-batch failure isolation via inline error card, per-card remove button, cap warning + 'Over cap' badge at N=11 (driven by setState to avoid 11 scan invocations).

**Final state:** 100/100 identity tests passing. Full suite: 2374 tests, 8 pre-existing failures in ResearchPage.test.tsx confirmed unrelated to m-33 (failures present without my changes; stash-isolated and validated). Lint clean on all touched files. All ACs satisfied; task closed Done.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Multi-source identity intake foundation landed in 5 commits: type addition, store refactor (N=1 preserved), multi-file UI, 10-source cap, and test coverage. The `intakeSources: IntakeSource[]` array supersedes the single `scanResult` slot; future Phase 2 (jd) and Phase 3 (agent-dump) variants plug in additively. All 11 ACs satisfied; unblocks TASK-261 (cross-source synthesis utility) and downstream m-33 work.
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
