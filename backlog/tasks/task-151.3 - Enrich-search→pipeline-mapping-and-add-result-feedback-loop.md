---
id: TASK-151.3
title: Enrich search→pipeline mapping and add result feedback loop
status: To Do
assignee: []
created_date: '2026-04-19 06:03'
labels:
  - search-redesign
  - pipeline
  - feedback
milestone: m-25
dependencies:
  - TASK-152
  - TASK-151.1
  - TASK-159
  - TASK-163
references:
  - src/routes/research/researchUtils.ts
  - src/store/searchStore.ts
  - src/store/identityStore.ts
  - src/types/pipeline.ts
documentation:
  - 'backlog doc-24: Data Flow section, Feedback Loop section'
  - 'backlog doc-26: Stage 3 Discovery Extraction'
parent_task_id: TASK-151
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Connect enriched search results to pipeline entries and add a feedback mechanism that flows back to the identity model.

**Enriched pipeline mapping** — Update `createPipelineEntryDraft()` in `researchUtils.ts` to map new SearchResultEntry fields:
- `candidateEdge` → `positioning`
- `interviewProcess.format` → `format[]` (pre-populate interview format)
- `interviewProcess.builderFriendly/aiToolsAllowed` → `research.interviewSignals`
- `companyIntel.stage/aiCulture/remotePolicy` → `research.summary` and/or `notes`
- `advantageMatch` → enrich `skillMatch` or `positioning`
- `signalGroup` → inform `tier` or `notes`
- `estimatedComp` → `comp`

**Search result feedback loop** — When user reviews results, lightweight inline actions:
- Thumbs up/down per result with optional reason
- Quick-add to avoid list from a bad result
- Quick skill depth correction trigger ("I don't actually know [skill] that well")
- Feedback events stored as `SearchFeedbackEvent` (schema from TASK-163) in searchStore
- Aggregated feedback available to thesis regeneration via `SearchThesis.feedbackIncorporated[]` references

**Identity model writeback** — Feedback that affects the identity model (precedence rules from TASK-159):
- Skill depth corrections → `identity.skills.groups[].items[].depth` with `depthSource: 'corrected'`
- Preference discovery → `identity.preferences.matching.prioritize[]`
- Avoid additions → `identity.preferences.matching.avoid[]` (with condition)
- Vector expansion → `identity.search_vectors[]`
- Each writeback bumps `identity.version` and marks feedback event `appliedToIdentity: true`

**Aggregation logic for thesis regeneration:**
- Query: `SearchFeedbackEvent[]` where `appliedToIdentity === true` AND `reflectedInThesisId !== currentThesisId`
- Pass to thesis generator (TASK-151.1) as priors; stamp those IDs onto the new thesis's `feedbackIncorporated[]`

See doc-24 (Feedback Loop, Identity Model Lifecycle), doc-26 (Stage 3: Discovery Extraction).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 createPipelineEntryDraft maps candidateEdge to positioning
- [ ] #2 createPipelineEntryDraft pre-populates format[] from interviewProcess when available
- [ ] #3 createPipelineEntryDraft maps companyIntel fields to research.summary or notes
- [ ] #4 Search result cards have thumbs up/down actions with optional reason field
- [ ] #5 Thumbs down offers quick-add to avoid list
- [ ] #6 Feedback events stored in searchStore with result ID, rating, reason, and timestamp
- [ ] #7 Skill depth corrections from feedback update identity model with user confirmation dialog
- [ ] #8 Aggregated feedback is available as input to thesis regeneration
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
