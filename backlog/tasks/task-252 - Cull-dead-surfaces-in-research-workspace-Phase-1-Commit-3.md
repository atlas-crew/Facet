---
id: TASK-252
title: 'Cull dead surfaces in research workspace (Phase 1, Commit 3)'
status: In Progress
assignee:
  - claude
created_date: '2026-05-10 16:25'
updated_date: '2026-05-11 05:20'
labels:
  - research
  - phase-1-cull
  - subtractive-cleanup
  - type-changes
milestone: m-31
dependencies: []
references:
  - docs/audits/2026-05-10/report.md
  - TASK-205
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Goal

Subtractive cull of 6 visual-debt surfaces in the research workspace after the v3.1 architectural shifts. Plus removal of two type fields (`narrative`, `interviewStrategy`) from `SearchThesis` since their UI is gone and they don't drive run behavior.

Commit 3 of the Research Workspace Phase 1 cull plan (originally handed to agent 2026-05-10). Commits 1 (identity schema + SelfModel band) and 2 (research moat/advantages → read-only) are landed; Commit 5 (dead setters) is landed; Commit 4 (skill-depth triage) is the sibling of this commit.

## Locked decisions (do not re-litigate)

- **Search launcher cull**: empty-state branch only. Keep the explicit Launch button. (After v3.1 shifts, profile inference is initiated from identity; the empty-state launch path is redundant.)
- **Constraints display cull**: identity-base readout only. Keep the override editor (`research-preferences-overrides`) — per-search divergence from identity is not redundant.
- **Keyword combinations**: remove the visible editing UI; keep the data flow (LLM still emits, deep-research request body still carries `thesisSnapshot.keywordCombinations`).
- **Skill rendering**: keep the `skillDepthMap` calibration view (Commit 4 reorganizes it). Remove `SearchSkillsTable` (the legacy `searchProfile.skills` table view).

## Surfaces to remove (with reconnaissance citations from 2026-05-10)

| # | Surface | File:line |
|---|---|---|
| 1 | Empty-state launcher branch | `src/routes/research/ResearchPage.tsx:2814` (conditional `!effectiveProfile ? handleInfer() : handleLaunchSearch()`) |
| 2a | Thesis narrative editor | `src/routes/research/ResearchPage.tsx:3365-3372` (textarea writing `thesisDraft.narrative`) |
| 2b | Thesis narrative display | `src/routes/research/searchWorkspaceComponents.tsx:299-306` (renders `activeThesis.narrative` paragraphs) |
| 3 | Interview strategy editor | `src/routes/research/ResearchPage.tsx:3389-3396` |
| 4 | Keyword combinations UI | `src/routes/research/ResearchPage.tsx:3631-3680` (editing section) plus handlers at `:1705-1726`, `:2345-2399` |
| 5 | `SearchSkillsTable` component | `src/routes/research/searchWorkspaceComponents.tsx:340-425` (component); render site at `src/routes/research/ResearchPage.tsx:2940` |
| 6 | Identity-base constraints readout | `src/routes/research/searchWorkspaceComponents.tsx:519-605` (the `research-preferences-base` div within `SearchInstancePreferences`) |

## Type-field removals

Remove `narrative` and `interviewStrategy` from `SearchThesis` (`src/types/search.ts`). Cascading updates:

- `src/utils/thesisGenerator.ts`: remove from response schema (around line 583), remove from `normalizeGeneratedSearchThesis` (around line 480-484), remove the `narrative` length check from `validateSearchThesis` (line 510-512).
- `src/store/searchStore.ts`: remove from `hydrateThesis` defaults (around line 643-661 region).
- Verify `src/utils/searchExecutor.ts` doesn't read these fields for prompt construction.

## CRITICAL: do NOT touch (different namespace despite similar names)

- **search-run narrative** (`activeRunNarrative`, `narrativeState`, `runPatch.narrativeState` at `ResearchPage.tsx:1208-1214, 2785-2787, 4309-4365`) — this is per-run search output, NOT the thesis narrative. Stays.
- **`runPatch.narrativeState.contractViolations`** at `ResearchPage.tsx:1213` — same; per-run narrative validation, not thesis.

## Test cascade (expect substantial surgery)

`src/test/ResearchPage.test.tsx`:
- "generates, edits, and saves a search thesis revision from identity" (line ~677): currently fires events on `Thesis narrative`, `Interview strategy`, `Keyword 1 query/lane/noise`. Remove those interactions and corresponding assertions on saved thesis fields.
- "removes a keyword combination directly without disturbing siblings" (line ~2329): tests keyword combo UI removal — delete or refactor to test the data layer directly.
- Several keyword-combination tests at lines ~2076, ~2107, ~2146 — review and remove or refactor.
- Search across the file for any `getByLabelText('Thesis narrative')` / `'Interview strategy'` / `'Keyword 1 query/lane/noise'` / `'Add advantage'` / table-based skill assertions.

`src/test/thesisGenerator.test.ts`:
- "validates narrative, lane rationale, and identity skill coverage" (line ~710): currently expects `'narrative: expected 3-5 paragraphs...'` violation. Remove (no more narrative field).
- Any test fixtures with `narrative:` or `interviewStrategy:` in thesis construction — remove.

`src/test/persistence.test.ts`, `src/test/researchJobs.test.ts`, `src/test/searchRedesignRoundTrip.test.tsx`, `src/test/workspaceBackup.test.ts`, `src/test/deepSearchClient.test.ts`:
- Search for `narrative:` and `interviewStrategy:` in test fixtures; remove.

## Verification

After changes:
- `npm run typecheck` passes
- `npx vitest run` passes (full suite)
- Manual smoke: derive a thesis from identity, run a deep-research job to completion (SSE + poll), verify keyword combinations still flow to the proxy in the request body even though no UI edits them, push to pipeline, push skill-depth correction back to identity.

## Out of scope

- `lookFor`/`avoid` editing UX (Phase 2 redesigns severity/condition surfacing)
- Per-result signal-match annotations (Phase 2)
- Legacy executor path consolidation (Phase 2)
- `SearchProfile` shape narrowing or removal (defer to Phase 2)

## Related work

- TASK-205 — broader move of Constraints/Preferences/Skills off Profile Editor. The identity-base constraints readout cull here is the cleanup phase of that migration.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All 6 surfaces enumerated above are removed at the cited locations
- [x] #2 narrative and interviewStrategy fields removed from SearchThesis type with cascading updates in thesisGenerator (prompt schema, normalize, validate) and searchStore (hydrateThesis defaults)
- [x] #3 Search-run narrative (activeRunNarrative / narrativeState) is preserved untouched — verified by grep showing references at ResearchPage.tsx:1208, 2785, 4309 still resolve
- [x] #4 Keyword combination data flow preserved: thesisSnapshot.keywordCombinations still appears in deep-research POST body (verifiable via deepSearchClient.test.ts)
- [x] #5 npm run typecheck passes
- [x] #6 Full test suite passes; tests exercising removed UI are deleted or refactored
- [ ] #7 Manual smoke verifies: thesis derive → search run → results triage → push-to-pipeline still works end-to-end
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Reconnaissance (post-1ca4935 / fa7495e cull commits)

Verified line numbers in current main:
- Empty-state launcher: ResearchPage.tsx:2770 (conditional onClick) + 2773-2774 (icon switch)
- Thesis narrative editor: ResearchPage.tsx:3325-3326
- Interview strategy editor: ResearchPage.tsx:3361-3372
- Keyword combinations UI: ResearchPage.tsx:3605-3680 (display) + 1705-1726 (remove handler) + 2301-2399 (patch/add handlers)
- Thesis narrative display: searchWorkspaceComponents.tsx:299-306
- SearchSkillsTable: searchWorkspaceComponents.tsx:340-425; rendered at ResearchPage.tsx:2896
- Identity-base constraints readout: searchWorkspaceComponents.tsx:520-605
- SearchThesis.narrative / SearchThesis.interviewStrategy: types/search.ts:562, 571
- searchExecutor.ts confirmed clean — all `narrative` references are SearchRunNarrative (per-run), NOT thesis-level

## Edit plan

**A. UI surface removals (6 surfaces)**

1. Empty-state launcher: drop the `!effectiveProfile ? handleInfer()` branch; use `handleLaunchSearch()` unconditionally; collapse the icon/label conditional
2a. Thesis narrative editor block (textarea + label/wrapper)
2b. Thesis narrative display (paragraph render block)
3. Interview strategy editor block
4. Keyword combinations UI + handlers; KEEP thesisSnapshot.keywordCombinations data flow
5. Delete SearchSkillsTable component + its import + render site
6. Remove `research-preferences-base` div (keep override editor)

**B. Type-field removals**

Remove `narrative` and `interviewStrategy` from `SearchThesis` in types/search.ts.

**C. Cascading non-UI updates**

- thesisGenerator.ts: drop fields from normalizeGeneratedSearchThesis, drop narrative violation, remove from prompt schema + contract
- searchStore.ts: drop fields from hydrateThesis defaults

**D. Test surgery**

- ResearchPage.test.tsx: remove fields from default thesis + 6 fixtures; delete keyword-combo tests; remove "Thesis narrative"/"Interview strategy" interactions from edit-and-save test
- thesisGenerator.test.ts: remove interviewStrategy from 8 fixtures; remove narrative-violation test scaffolding
- persistence.test.ts, searchRedesignRoundTrip.test.tsx, workspaceBackup.test.ts, researchJobs.test.ts, deepSearchClient.test.ts: remove fields from top-level SearchThesis fixtures only (preserve `narrative: { ... }` SearchRun blocks)

**E. Verification gates**

1. npm run typecheck
2. npx vitest run
3. AC #3 grep: activeRunNarrative/narrativeState references intact
4. AC #4 grep: keywordCombinations still flows in deepSearchClient + searchExecutor
5. Manual smoke (owner): derive thesis → run search → triage results → push to pipeline → skill-depth writeback

**F. Commit shape**

Single atomic commit: `refactor(research): cull dead UI surfaces and thesis narrative/interviewStrategy fields`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Verification status:**
- typecheck: PASSES (0 errors after surgical fixes for now-removed type-field consumers)
- vitest: 2356 PASSING in second run; one prepImport flake (passes in isolation, fails ~50% in full suite due to pre-existing test-isolation pollution unrelated to task-252 — same flake observed before my changes)
- lint: 8 errors all in untouched files (useElapsed.ts, slotPrimitives.tsx, hosted/diag.spec.ts, hosted/entitlement-billing.spec.ts) — DoD #5 (touched files) satisfied
- AC #3: confirmed grep shows activeRunNarrative + narrativeState references at ResearchPage.tsx:1187, 2647, 4031 still resolve
- AC #4: confirmed thesisSnapshot is sent whole at deepSearchClient.ts:206; thesisSnapshot.keywordCombinations preserved through serialization
- AC #7 manual smoke: NOT YET RUN — owner needs to verify thesis derive → search run → results triage → push-to-pipeline

**Build status:** `npm run build` FAILS in src/utils/prepImport.ts:164 — but this file is part of a parallel in-flight prep-card-shape-refactor (milestone m-32) that arrived in the working tree DURING this session. Stashing my task-252 changes and running build still shows the same error in the prep refactor's own files (verified: `git stash && npm run build` succeeds because the prep refactor includes prepImport.ts modifications that I stashed too — actually wait, the stash captured the prep refactor too since it was uncommitted. The prep refactor changes are NOT mine and should not be committed under task-252.)

**In-flight files NOT touched by task-252 (parallel session work, leave uncommitted):**
src/routes/prep/PrepCardView.tsx, src/store/prepStore.ts, src/test/PrepCardView.test.tsx, src/test/PrepLiveMode.test.tsx, src/test/PrepPage.behavior.test.tsx, src/test/PrepPage.identityGeneration.test.tsx, src/test/PrepPage.test.tsx, src/test/PrepPracticeMode.test.tsx, src/test/fixtures/personas/dianeOkafor.ts, src/test/fixtures/personas/marcusKim.ts, src/test/prepCheatsheet.test.ts, src/test/prepContractValidation.test.ts, src/test/prepGenerator.test.ts, src/test/prepImport.test.ts, src/test/prepStore.test.ts, src/types/prep.ts, src/utils/prepGenerator.ts, src/utils/prepImport.ts

**Shared file:** src/test/fixtures/personas/mayaPatel.ts has both my SearchThesis narrative+interviewStrategy removal AND parallel session's prepDeck `kind:` additions. Hunk-stage my edit only via cortex git patch.

**Files I authored for this commit:**
proxy/researchJobs.js, src/routes/research/ResearchPage.tsx, src/routes/research/searchWorkspaceComponents.tsx, src/store/searchStore.ts, src/test/AppShell.test.tsx, src/test/ResearchPage.test.tsx, src/test/SearchInstancePreferences.editInIdentity.test.tsx, src/test/deepSearchClient.test.ts, src/test/persistence.test.ts, src/test/researchJobs.test.ts, src/test/searchRedesignRoundTrip.test.tsx, src/test/searchStore.test.ts, src/test/thesisGenerator.test.ts, src/test/workspaceBackup.test.ts, src/types/search.ts, src/utils/thesisGenerator.ts (and the mayaPatel.ts hunk for SearchThesis cleanup)

**Test deletions/refactors performed:**
DELETED 5 ResearchPage tests for the removed empty-state inference flow (locked decision: profile inference now initiated from Identity, not the launcher button). DELETED 6 keyword-combination tests (the underlying UI is gone). DELETED 1 SearchSkillsTable hide-skill test. DELETED 2 SearchInstancePreferences `Edit in Identity` button tests. REFACTORED the staleness-refresh-blocking-on-unsaved-edits test to use Look-for signals as the dirty trigger. REFACTORED the 'preserves unchanged look-for entries with commas' test to use Skill depth 1 calibration as the dirty trigger. REFACTORED the bindings test to drop the hide-skill bits. REFACTORED 'edits, generates, saves' assertion: keyword combination assertion now expects the unchanged LLM-generated combo (no UI to edit it).

**Follow-ups not in scope:** consider renaming SearchInstancePreferences.editInIdentity.test.tsx to drop 'editInIdentity' from the filename (the file no longer tests that retrofit). Skipped here to avoid mixing rename with cull commit.
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
