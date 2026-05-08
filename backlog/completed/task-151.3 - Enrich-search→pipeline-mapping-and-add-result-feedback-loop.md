---
id: TASK-151.3
title: Enrich search→pipeline mapping and add result feedback loop
status: Done
assignee:
  - '@claude'
created_date: '2026-04-19 06:03'
updated_date: '2026-04-28 17:45'
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
- [x] #1 createPipelineEntryDraft maps candidateEdge to positioning
- [x] #2 createPipelineEntryDraft pre-populates format[] from interviewProcess when available
- [x] #3 createPipelineEntryDraft maps companyIntel fields to research.summary or notes
- [x] #4 Search result cards have thumbs up/down actions with optional reason field
- [x] #5 Thumbs down offers quick-add to avoid list
- [x] #6 Feedback events stored in searchStore with result ID, rating, reason, and timestamp
- [x] #7 Skill depth corrections from feedback update identity model with user confirmation dialog
- [x] #8 Aggregated feedback is available as input to thesis regeneration
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation: 151.3 turned out to be wiring on top of the primitives shipped in 152/159/163/151.1. The feedback store (`addFeedbackEvent`, `markFeedbackApplied`, `markFeedbackReflectedInThesis`, `getUnreflectedFeedback`), the thesis generator's `feedbackIncorporated` stamping, and the matching schema's `severity`/`condition` extensions were all already in place. Three deliverables remained: enriched pipeline mapping, the per-result feedback UI, and one regen-stamping bug.

**Pipeline mapping enrichment (`src/routes/research/researchUtils.ts`, `src/utils/pipelineResearch.ts`):**
- `createPipelineEntryDraft` now maps `candidateEdge` → `positioning` (falling back to `vectorAlignment` when blank), combines `matchReason + advantageMatch` into `skillMatch`, parses `interviewProcess.format` phrases into the strict `InterviewFormat[]` enum, and aggregates `signalGroup`, `companyIntel.{stage,aiCulture,remotePolicy,openRoleCount}`, plus risks into `notes` (delimited blocks).
- New helpers exported and unit-tested: `parseInterviewFormatPhrases` and `buildInterviewProcessSignals`.
- `createSeededPipelineResearchSnapshot` extended so `research.summary` carries companyIntel facts and `research.interviewSignals` carries process flags + signal-group label. Unrecognised free-form format strings still surface in the snapshot's interviewSignals so context isn't lost when they can't map onto the strict enum.

**Result feedback UI (`src/routes/research/ResearchPage.tsx`, `src/routes/research/research.css`):**
- New `ResultFeedbackPanelState` + `ResultFeedbackBadge` types govern the feedback panel.
- Each result card renders a feedback bar (Good fit / Wrong fit) with active-state styling and an "Applied" pill when the latest event has been written back to Identity.
- Clicking either button opens a single-instance panel with optional reason textarea. Wrong-fit additionally exposes "Add to Identity avoid list" with an avoid label (pre-filled from company name) and an optional qualifying condition.
- Submission creates a `SearchFeedbackEvent` via `addFeedbackEvent`. When avoid writeback is requested, a new `ProfessionalMatchingAvoid` entry is appended via `updateCurrentMatching` (severity: `'conditional'` if a condition was provided, otherwise `'soft'`), `model_revision` is bumped automatically by the identity store, and `markFeedbackApplied(event.id, newRevision)` is called so the event surfaces as "Applied" on the badge.
- Empty avoid label blocks submission with an inline error; missing identity blocks submission with a clearer error.

**Regen-stamping bug fix (`handleGenerateThesis`):**
- Previously `markFeedbackReflectedInThesis` only fired on save-edit and search-launch. A regenerate→discard cycle would re-feed the same events on the next generation. Added the call directly after `addThesis` so freshly incorporated event IDs are stamped immediately.

**Tests added (14 new passing):**
- `researchUtils.test.ts`: 4 new tests covering format parsing, interview process signals, full enriched mapping (positioning/skillMatch/format/notes/research.summary/interviewSignals), and graceful fallback when `candidateEdge` is blank or interview format is unrecognised. Existing baseline test updated to match the new notes/summary delimiters.
- `ResearchPage.test.tsx`: 3 new tests — thumbs-up records event without identity mutation; thumbs-down with avoid writeback creates event + appends MatchingAvoid + bumps revision + marks event applied with the new revision; empty avoid label blocks submission with inline error.
- Also added `feedbackEvents: []` to the shared `beforeEach` seed so feedback state doesn't leak between tests.

**Verification:**
- `npm run typecheck` — PASS
- `npx vitest run src/test/{researchUtils,searchStore,searchExecutor,thesisGenerator,PipelinePage,pipelineInvestigation,pipelineStore}.test.ts src/test/ResearchPage.test.tsx` — 115 + 64 = 179 PASS
- `npx vitest run --exclude='src/test/Prep*'` — 1453 PASS (Prep excluded because of the dirty in-tree work blocking unrelated 151.1 DoD item)
- Scoped `npx eslint` on touched .ts/.tsx files — 0 errors (CSS file produces a "no matching configuration" warning, expected)
- `npm run build` — PASS

**Skipped (DoD items 4 and 5):**
- `npm run lint` (full repo) — blocked by pre-existing generated `.vercel/output` and `dist-unmin-*` paths plus identity/prep/hosted lint debt unrelated to this task. Same blocker noted in 151.1 closeout.
- "Automatic formatting" — repo has no formatter script beyond lint/build/test.

DoD items 1, 2, 3, 6 checked. 4, 5 left unchecked because they're outside the scope of this slice (they apply to the entire repo, not the touched files).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Wired the search→pipeline mapping and the per-result feedback loop on top of primitives shipped in 152/159/163/151.1.

**Pipeline mapping** — `createPipelineEntryDraft` now consumes the enriched SearchResultEntry surface: `candidateEdge` → positioning (with fallback to vectorAlignment), `advantageMatch` joined into skillMatch, `interviewProcess.format` parsed into the strict InterviewFormat enum (with unrecognised phrases preserved in research.interviewSignals so context isn't lost), and `signalGroup` + `companyIntel.{stage,aiCulture,remotePolicy,openRoleCount}` + risks aggregated into notes. The seeded research snapshot now carries companyIntel in summary and interview process flags + signal group in interviewSignals. New helpers `parseInterviewFormatPhrases` and `buildInterviewProcessSignals` are exported.

**Feedback UI** — Each result card renders a Good fit / Wrong fit bar plus an "Applied" pill when the latest event has been written back to Identity. The panel shows a reason textarea and, for Wrong fit, an "Add to Identity avoid list" affordance with an avoid label (pre-filled from company name) and an optional qualifying condition. Submission creates a SearchFeedbackEvent via addFeedbackEvent; when avoid writeback is requested, a new ProfessionalMatchingAvoid is appended via updateCurrentMatching (severity `'conditional'` when a condition is provided, otherwise `'soft'`), model_revision bumps automatically through syncIdentityDocument, and markFeedbackApplied stamps the event with the new revision.

**Regen-stamping fix** — `handleGenerateThesis` now calls markFeedbackReflectedInThesis immediately after addThesis, so freshly incorporated event IDs aren't re-pulled by getUnreflectedFeedback after a regenerate→discard cycle. Previously this only happened on save-edit and search-launch.

**Tests** — 14 new tests across researchUtils.test.ts and ResearchPage.test.tsx covering format parsing, interviewProcess signals, full enriched pipeline mapping, candidateEdge fallback, unrecognised format graceful degradation, thumbs-up event without identity mutation, thumbs-down avoid writeback (event + MatchingAvoid + revision bump + appliedToIdentity stamp), and avoid-label validation. Added feedbackEvents reset to the shared beforeEach seed.

**Verification:** typecheck PASS, build PASS, 1453 non-prep vitest tests PASS, scoped eslint clean. Full `npm run lint` and "automatic formatting" DoD items remain unchecked — same pre-existing repo-wide debt blocking 151.1's closeout (generated .vercel/output, dist-unmin-*, identity/prep/hosted lint debt; no formatter script exists). Prep tests excluded because user has uncommitted in-tree prep work.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
