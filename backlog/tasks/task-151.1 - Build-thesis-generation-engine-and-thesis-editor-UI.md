---
id: TASK-151.1
title: Build thesis generation engine and thesis editor UI
status: To Do
assignee: []
created_date: '2026-04-19 06:02'
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
- [ ] #7 Skill depth corrections update identity model with depthSource='corrected' flag; bumps identity.version
- [ ] #8 Confirmation dialog shows downstream impact before writeback
- [ ] #9 Search lanes can be added, removed, and reordered
- [ ] #10 Avoid-list entries can be added with qualifying condition
- [ ] #11 Thesis collection persists in searchStore (append-on-edit, not mutate-in-place)
- [ ] #12 Approved thesis takes immutable snapshot and triggers Phase 2 job creation
- [ ] #13 Thesis can be reused with different search parameters (geo, company size, etc.)
- [ ] #14 Staleness indicator shown when identity.version > thesis.identityVersion; regeneration preserves prior user edits
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
