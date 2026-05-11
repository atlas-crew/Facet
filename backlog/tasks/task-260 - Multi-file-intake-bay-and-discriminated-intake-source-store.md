---
id: TASK-260
title: Multi-file intake bay and discriminated intake-source store
status: In Progress
assignee:
  - '@claude'
created_date: '2026-05-11 05:20'
updated_date: '2026-05-11 05:27'
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
- [ ] #1 IntakeSource discriminated union exported from src/types/identity.ts with the `resume` variant fully typed and jd/agent-dump slots noted as TODO with their planned shape in adjacent comments
- [ ] #2 identityStore.scanResult slot removed; replaced with intakeSources: IntakeSource[] and the relevant setter/getter API
- [ ] #3 ExtractionAgentCard `<input type="file">` carries the `multiple` attribute and accepts multi-file selection
- [ ] #4 Drag-and-drop accepts multiple PDF files in one drop event
- [ ] #5 Each source rendered as a file card showing filename, page count, role/bullet/skill counts, optional userLabel text input, and a remove button
- [ ] #6 Sequential scan of dropped files; individual scan failure does not abort the batch and surfaces error inline on the failing card
- [ ] #7 N=1 flow (Generate Draft, Deepen All, Rescan, Clear) behaves identically to the previous single-file behavior
- [ ] #8 Cap of 10 sources enforced with an inline warning on above-cap files; remove action still works on above-cap files
- [ ] #9 Existing IdentityPage.test.tsx and identityStore.test.ts updated to the new store shape; all pre-existing assertions still pass under N=1
- [ ] #10 New tests cover: multi-file drop sequencing, mid-batch scan failure isolation, source removal, cap enforcement, userLabel persistence in store
- [ ] #11 Short JSDoc on the IntakeSource union explaining the discriminator and the seam intent for future Phase 2/3 sources
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Atomic commit decomposition

**Commit 1** — `feat(identity): introduce IntakeSource discriminated union and intakeSources store slot`
- `src/types/identity.ts`: IntakeSource union with `resume` arm wired; jd/agent-dump slots as TODO comments naming planned shape; JSDoc on the seam intent.
- `src/store/identityStore.ts`: replace `scanResult: ResumeScanResult | null` with `intakeSources: IntakeSource[]`. All 50+ internal references route through a `getActiveResumeScan(state)` helper (N=1 invariant holds because UI still single-file at this commit). Bump persist `version: 4 → 5` with migrate that maps persisted `scanResult: X` → `intakeSources: [{ kind: 'resume', id: <new>, scan: X }]` (or `[]` when null). Update `partialize`, `normalizePersistedIdentityState`, `merge`, `unwrapPersistedIdentityState`.
- `src/routes/identity/IdentityPage.tsx`: consumers refactored to read via `getActiveResumeScan` selector.
- Tests: `identityStore.test.ts` covers new store API + N=1 regression + persist migration; `IdentityPage.test.tsx` assertions preserved for N=1.

**Commit 2** — `feat(identity): multi-file intake selection and file-card list UI`
- `ExtractionAgentCard.tsx`: `<input multiple>`, multi-file drag-drop, per-source file cards (filename, counts, userLabel input, remove button).
- `IdentityPage.tsx`: sequential scan plumbing with isolated failure handling.
- Tests: multi-file drop sequencing, mid-batch failure isolation, removal.

**Commit 3** — `feat(identity): enforce 10-source intake cap`
- `ExtractionAgentCard.tsx`: cap-of-10 enforcement, above-cap inline warning.
- Tests: cap enforcement, above-cap removal still works.

## Persistence considerations (per facet-persistence-changes)

- `scanResult` IS in `identityStore.partialize` (line 1674) → real Zustand version bump required (`4 → 5`).
- `scanResult` is NOT in `src/persistence/` (workspace snapshot) → no snapshot adapter or contracts.ts touches needed.
- `intakeSources` stays Zustand-store-only (transient intake state, discarded after draft acceptance).
- Pre-launch posture permits dropping the migrate fallback if it grows complex, but the transform here is one-liner-cheap, so we keep it for local-dev convenience.

## Agent-loops cadence

Per atomic commit: Code Change Loop (`specialist-review.sh` on source files) → cortex git commit → Test Writing Loop (`diff-test-audit.sh`) → cortex git commit if tests added → Lint Gate → cortex git commit if lint changes.

Reviewer rotation: scripts try Claude last (since this session is Claude Opus); first review attempts route to Gemini/Codex via the provider-aware script.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Regression tests pass (scoped to touched files)
- [ ] #5 Linters report no warnings or errors in touched files
- [ ] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
