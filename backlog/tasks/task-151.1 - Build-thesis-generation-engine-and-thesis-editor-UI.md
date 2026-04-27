---
id: TASK-151.1
title: Build thesis generation engine and thesis editor UI
status: In Progress
assignee:
  - '@codex'
created_date: '2026-04-19 06:02'
updated_date: '2026-04-27 08:04'
labels:
  - search-redesign
milestone: m-23
dependencies:
  - TASK-150
  - TASK-152
  - TASK-159
  - TASK-160
references:
  - src/utils/searchExecutor.ts
  - src/routes/research/ResearchPage.tsx
  - src/store/searchStore.ts
  - src/identity/schema.ts
documentation:
  - 'backlog doc-24: Phase 1 Thesis Generation section'
  - 'backlog doc-24: Identity Model Lifecycle'
  - 'backlog doc-24: Output Contract: Reasoning Layers'
  - 'backlog doc-26: Stage 2 Search Thesis'
parent_task_id: TASK-151
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Phase 1 of the search redesign. Build the thesis generation step that analyzes the identity model and produces a SearchThesis, plus the editor UI where users review, correct, and approve the thesis before committing to the expensive deep search.

This task is large — consider splitting into 151.1a (generator + read-only renderer), 151.1b (skill-depth inline editor with identity writeback), 151.1c (lane/keyword/avoid editor), and 151.1d (reuse UX) if agent review cycles get too long.

**Thesis generation engine** (`src/utils/thesisGenerator.ts` or similar):
- Input: full identity model (self_model, profiles, skills with PAIO context, search_vectors, preferences with conditions, calibration notes) + previous feedback + current `identity.version`
- AI call: Opus with extended thinking (budget 10K tokens), ~60s, feature key `research.thesis`
- Output: `SearchThesis` object with all structured fields PLUS `narrative` (3-5 paragraph cohesive strategy explanation) and `identityVersion` metadata
- Must send archetype/arc, calibration notes, PAIO bullet highlights, preference conditions — NOT a flat skill list
- Prompt must enforce reasoning output contract (see doc-24 Output Contract):
  - Each `SearchLane.rationale` and `competitiveContext` must be prose, not phrases
  - `SearchThesis.narrative` must be 3-5 paragraphs weaving moat → advantages → lanes into a story
  - Each `SearchSkillDepthEntry.context` must cite specific PAIO evidence
- Validate output: assert narrative length, lane rationales are >1 sentence, skillDepthMap covers all user skills
- On contract violation: surface "regenerate" affordance and log to telemetry

**Thesis editor UI** (in ResearchPage or new component):
- Render thesis as an editable panel: narrative at top, then moat statement, advantage cards, lane cards with rationale, skill depth table with inline correction
- Skill depth corrections → identity model writeback with `depthSource: 'corrected'` flag (TASK-159 precedence rule)
- Confirmation dialog before writeback: "This will update your identity model. Affects N other artifacts."
- Lane add/remove/reorder; keyword combination editing; avoid-list editing with `condition`
- "Run Search" button that approves thesis, takes immutable snapshot, and triggers Phase 2 job creation (TASK-151.2)
- Thesis stored in searchStore as `theses: SearchThesis[]` collection (append-on-edit, not mutate-in-place)
- Each `SearchRun` references thesis via `thesisId` AND carries `thesisSnapshot` for reproducibility

**Correction flow** (shepherding — doc-26, Stage 2):
- Surface 5-8 lowest-confidence items for correction
- Show downstream impact: "correcting this depth will change N search results and M prep cards"
- Corrections to skill depth, calibration, preferences, and vectors flow back to identity model; each correction increments `identity.version`

**Thesis reuse / regeneration:**
- Existing thesis surfaces on workspace mount; user can reuse with new params or regenerate
- Staleness indicator when `identity.version > thesis.identityVersion` (offers regeneration)
- Regeneration carries forward user edits as priors ("previously you set K8s to architectural")
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Thesis generator sends full identity context (self_model, profiles, PAIO bullets, calibration notes, preferences with conditions) — not a flat skill list
- [ ] #2 AI call uses Opus model with extended thinking (10K budget)
- [ ] #3 Generated thesis includes all SearchThesis fields: moat, unfair advantages, lanes, interview strategy, keywords, skill depth map, PLUS narrative field
- [ ] #4 Prompt enforces reasoning output contract: narrative is 3-5 paragraphs, lane rationales are prose, skill depth context cites PAIO evidence
- [ ] #5 Output validation flags contract violations and surfaces regenerate affordance
- [ ] #6 Thesis editor renders all thesis sections as reviewable/editable content, narrative at top
- [x] #7 Skill depth corrections update identity model with depthSource='corrected' flag; bumps identity.version
- [x] #8 Confirmation dialog shows downstream impact before writeback
- [ ] #9 Search lanes can be added, removed, and reordered
- [ ] #10 Avoid-list entries can be added with qualifying condition
- [ ] #11 Thesis collection persists in searchStore (append-on-edit, not mutate-in-place)
- [ ] #12 Approved thesis takes immutable snapshot and triggers Phase 2 job creation
- [ ] #13 Thesis can be reused with different search parameters (geo, company size, etc.)
- [ ] #14 Staleness indicator shown when identity.version > thesis.identityVersion; regeneration preserves prior user edits
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Claim TASK-151.1 and keep the first loop focused on a reviewable foundation slice rather than trying to swallow the whole thesis editor in one commit.\n2. Inspect current SearchThesis/SearchRun types, searchStore, ResearchPage, AI proxy/client helpers, and existing Research tests.\n3. Implement thesis generation foundations: prompt/client module, store thesis collection + active draft metadata, persistence/migration support, and minimal Research UI affordance for generating/reusing a thesis before deep search.\n4. Add focused tests for thesis generation payload, validation/contract violations, store persistence, and Research UI launch handoff.\n5. Run focused tests/typecheck/lint, independent review/test-audit, remediate, update Backlog, and commit via cortex git commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started first implementation loop for thesis generation/editor foundations after TASK-151.2 async job client landed. Scope is a coherent foundation slice, not the full large task if review/test gates reveal it should be split.

Foundation implementation loop completed: added thesis generation client/prompt validation, Facet proxy thinking-budget passthrough, searchStore thesis persistence + active selection, workspace snapshot/hydration/merge validation, and ResearchPage thesis generate/review/edit/reuse UI. Deep search now uses the approved active thesis snapshot when present. Verification: npm run typecheck; npx vitest run src/test/thesisGenerator.test.ts src/test/llmProxy.test.ts src/test/searchStore.test.ts src/test/workspaceBackup.test.ts src/test/persistence.test.ts src/test/ResearchPage.test.tsx; targeted eslint on changed TS/TSX; npm run test; npm run build. Independent review/test-audit artifacts: .agents/reviews/review-20260425-052336.md and .agents/reviews/test-audit-20260425-052737.md. Remaining TASK-151.1 scope: identity writeback confirmation/impact flow, lane reorder + keyword editor depth, and final AC reconciliation.

Deep editor loop completed: expanded the Search Thesis editor with editable interview strategy/look-for/timeline, unfair advantage CRUD, lane reorder/removal, keyword combination CRUD with lane integrity guards, and skill-depth search signal/calibration edits. Tightened SearchUnfairAdvantage/SearchKeywordCombination ids to required, added hydration/generator/fallback snapshot id population, preserved unchanged look-for entries containing commas, and kept orphan keyword save validation explicit.

Verification receipts: npm run typecheck; npx vitest run src/test/ResearchPage.test.tsx src/test/thesisGenerator.test.ts src/test/searchStore.test.ts src/test/researchJobs.test.ts; scoped ESLint for changed research/store/generator files; npm run test (130 files, 1540 tests); npm run build. Independent review artifacts: .agents/reviews/review-20260426-013802.md. Test-audit artifacts: .agents/reviews/test-audit-20260426-014231.md and .agents/reviews/test-audit-20260426-014527.md. Remaining TASK-151.1 scope is identity writeback confirmation/impact flow and final AC reconciliation.

Identity writeback loop completed: skill-depth rows now open an inline confirmation region with workspace impact context, write back to Identity through saveSkillEnrichment with depthSource='corrected', and guard against stale identity revisions, renamed/missing skills, unsupported depths, empty positioning, and cancel/apply flows. Added inline lane/timeline validation affordances and preserved unsaved thesis edits during writeback.

Verification receipts: npm run typecheck; npm run build; npx vitest run src/test/ResearchPage.test.tsx (57 tests); npx eslint src/routes/research/ResearchPage.tsx src/test/ResearchPage.test.tsx; tab scan on touched TS/TSX files. Independent review artifacts include .agents/reviews/review-20260427-033712.md (fallback after Claude invalid artifact and Gemini capacity timeout; final P1 remediated) and test audit .agents/reviews/test-audit-20260427-035003.md (P1 cancel gap remediated after audit).
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
