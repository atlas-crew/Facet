---
id: TASK-252
title: 'Cull dead surfaces in research workspace (Phase 1, Commit 3)'
status: To Do
assignee: []
created_date: '2026-05-10 16:25'
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
- [ ] #1 All 6 surfaces enumerated above are removed at the cited locations
- [ ] #2 narrative and interviewStrategy fields removed from SearchThesis type with cascading updates in thesisGenerator (prompt schema, normalize, validate) and searchStore (hydrateThesis defaults)
- [ ] #3 Search-run narrative (activeRunNarrative / narrativeState) is preserved untouched — verified by grep showing references at ResearchPage.tsx:1208, 2785, 4309 still resolve
- [ ] #4 Keyword combination data flow preserved: thesisSnapshot.keywordCombinations still appears in deep-research POST body (verifiable via deepSearchClient.test.ts)
- [ ] #5 npm run typecheck passes
- [ ] #6 Full test suite passes; tests exercising removed UI are deleted or refactored
- [ ] #7 Manual smoke verifies: thesis derive → search run → results triage → push-to-pipeline still works end-to-end
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
