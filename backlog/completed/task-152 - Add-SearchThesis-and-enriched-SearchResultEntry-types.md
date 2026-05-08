---
id: TASK-152
title: Add SearchThesis and enriched SearchResultEntry types
status: Done
assignee: []
created_date: '2026-04-19 06:01'
updated_date: '2026-04-19 08:15'
labels:
  - search-redesign
  - types
milestone: m-20
dependencies:
  - TASK-150
references:
  - src/types/search.ts
  - src/utils/searchExecutor.ts
documentation:
  - 'backlog doc-24: Design Supporting Concepts section'
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the `SearchThesis` interface and extend `SearchResultEntry` with new fields. These are type definitions only — no UI, no AI calls, no store changes.

**SearchThesis** — the strategic hypothesis that drives search execution:
- `competitiveMoat: string`
- `unfairAdvantages: Array<{ combination, depth, targetCompanyProfile }>`
- `searchLanes: Array<{ id, title, rationale, competitiveContext?, targetSignals[] }>`
- `interviewStrategy: string`
- `lookFor: string[]`, `avoid: Array<{ label, condition? }>`
- `timeline?: { urgency, deadline?, strategyImpact }`
- `keywordCombinations: Array<{ query, lane, noiseLevel }>`
- `skillDepthMap: Array<{ skill, depth, context, searchSignal, calibration? }>`
- Metadata: `source`, `identityVersion`, `feedbackIncorporated[]`

**SearchResultEntry extensions** (additive, existing fields unchanged):
- `candidateEdge: string` — "Why this candidate wins here" narrative
- `interviewProcess?: { format, builderFriendly, aiToolsAllowed, estimatedTimeline? }`
- `companyIntel?: { stage, aiCulture, remotePolicy, openRoleCount? }`
- `signalGroup?: string` — "every signal aligns" | "most signals converge" | etc.
- `advantageMatch?: string` — which unfair advantage drove this result

Full type specs in backlog doc-24, Design: Supporting Concepts section.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 SearchThesis interface defined in src/types/search.ts with all fields from doc-24 spec
- [ ] #2 SearchResultEntry extended with candidateEdge, interviewProcess, companyIntel, signalGroup, advantageMatch (all optional except candidateEdge)
- [ ] #3 normalizeResults() in searchExecutor.ts handles new optional fields gracefully (undefined when absent)
- [ ] #4 Existing SearchResultEntry consumers compile without changes (backward compatible)
- [ ] #5 Type exports added to barrel files where needed
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added SearchThesis interface and enriched SearchResultEntry with new fields for the deep research redesign.

**SearchThesis type** (`src/types/search.ts`):
- Full strategic hypothesis type with: `competitiveMoat`, `unfairAdvantages[]` (combination + depth + target profile), `searchLanes[]` (id, title, rationale, competitive context, target signals), `interviewStrategy`, `lookFor[]`, `avoid[]` (with condition), `timeline?` (urgency, deadline, strategy impact), `keywordCombinations[]` (query, lane, noise level), `skillDepthMap[]` (skill, depth, context, search signal, calibration), plus metadata (source, identity version, feedback incorporated)
- Supporting types extracted: `SearchUnfairAdvantage`, `SearchLane`, `SearchThesisAvoid`, `SearchTimeline`, `SearchKeywordCombination`, `SearchSkillDepthEntry`, `SearchThesisSource`, `SearchUrgency`, `SearchNoiseLevel`

**SearchResultEntry extensions** (`src/types/search.ts`):
- `candidateEdge?: string` — \"Why this candidate wins here\" narrative
- `interviewProcess?: SearchResultInterviewProcess` — format, builder-friendly, AI tools allowed, timeline
- `companyIntel?: SearchResultCompanyIntel` — stage, AI culture, remote policy, open role count
- `signalGroup?: string` — signal convergence grouping
- `advantageMatch?: string` — which unfair advantage drove the match

**Normalization** (`src/utils/searchExecutor.ts`):
- Added `normalizeInterviewProcess()` and `normalizeCompanyIntel()` helpers
- Updated `normalizeResults()` to extract and normalize all new fields from AI responses
- All new fields are optional — undefined when absent, preserving backward compatibility

**Tests added (4 new in `searchExecutor.test.ts`):**
- Enriched fields normalized correctly when present
- Enriched fields undefined when absent from response
- Partial interviewProcess (missing optional booleans default to false)
- Empty companyIntel dropped when all fields are empty strings

Files changed: `src/types/search.ts`, `src/utils/searchExecutor.ts`, `src/test/searchExecutor.test.ts`. All 1231 tests pass."
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
