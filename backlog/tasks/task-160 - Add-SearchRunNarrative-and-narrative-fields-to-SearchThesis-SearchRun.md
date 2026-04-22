---
id: TASK-160
title: Add SearchRunNarrative and narrative fields to SearchThesis/SearchRun
status: Done
assignee: []
created_date: '2026-04-19 09:00'
updated_date: '2026-04-20 04:57'
labels:
  - search-redesign
  - types
  - foundation
milestone: m-20
dependencies:
  - TASK-152
  - TASK-159
references:
  - src/types/search.ts
  - src/utils/searchExecutor.ts
documentation:
  - 'backlog doc-24: Output Contract: Reasoning Layers section'
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up to TASK-152. Extend the search type surface with the narrative reasoning layers that doc-24's Output Contract section requires, plus the `ResearchJob` type used by the async job infrastructure (TASK-161).

**New type: `SearchRunNarrative`** — the run-level envelope the model produces.

Reference output analysis (see `backlog/reference files/Where Builders Beat Leetcoders_.pdf` and `Platform and Security Platform Job Search Report.pdf`) revealed that reference search outputs have 5 distinct narrative layers, not 2. Earlier version of this task had `executiveSummary + searchApproach`; expanded per the reference analysis:

```typescript
interface SearchRunNarrative {
  // Opening layers (the argument before results)
  competitiveMoat: string              // What makes the candidate structurally different
  selectionMethodology: string         // How the shortlist was filtered (criteria + sources)
  marketContext: string                // Landscape paragraph citing broader trends
  scoringRubric?: string[]             // How match scores were computed (transparency)

  // Lane structure (for lane-grouped reports)
  laneSummaries?: Array<{
    lane: string
    narrative: string
    topCompanies: string[]
  }>

  // Closing layers (synthesis after results)
  landscapeTrends?: string             // Market-shift paragraph with citations
  objectiveRecommendations?: Array<{
    objective: string                  // "security-domain leverage", "compensation", "portfolio-as-interview"
    recommendedCompanies: string[]
    rationale: string
  }>
  applicationPlan?: ApplicationPlan    // Gantt-style dated phases
  visualizations?: Array<{
    type: 'mermaid-gantt' | 'mermaid-xychart' | 'mermaid-other'
    source: string                     // Mermaid source code
    caption?: string
  }>

  // Top-of-output summary (compression of everything)
  executiveSummary: string             // 3-5 sentences: what was found and why

  // Feedback surfaces
  surprises?: string[]                 // Observations worth feeding back
  rejectedCandidates?: Array<{
    company: string
    reason: string
  }>
  nextSteps?: string[]
  references?: Array<{                 // Resolved footnote references (numbered-citation mode)
    id: string | number
    url: string
    title?: string
  }>
}

interface ApplicationPlan {
  startDate: string
  targetOfferDate?: string
  phases: Array<{
    name: 'materials' | 'outreach' | 'prep' | 'close' | string
    tasks: Array<{
      label: string
      startDate: string                // ISO date
      durationDays: number
      dependencies?: string[]
    }>
  }>
  mermaidDiagram?: string              // Optional Mermaid Gantt source
}
```

Note: `Citation` type is defined separately in TASK-184; SearchRunNarrative prose fields use `[cite:<id>]` inline markers.

**Extend `SearchRun`** with:
- `narrative?: SearchRunNarrative`
- `jobId?: string` (links to ResearchJob record, for rejoin semantics)
- `thesisId?: string` and `thesisSnapshot?: SearchThesis` (snapshot for reproducibility — runs don't mutate when theses evolve)
- `identityVersion?: number` (from TASK-159, for staleness detection)

**Extend `SearchThesis`** with:
- `narrative: string` (3-5 paragraph cohesive strategy explanation, required — not optional)

**New type: `ResearchJob`** — the durable job record (storage shape lives in TASK-161; type definition lives here):

```typescript
interface ResearchJob {
  id: string
  userId: string
  thesisId: string
  thesisSnapshot: SearchThesis
  identityVersion: number
  params: SearchRequest
  status: 'queued' | 'running' | 'completed' | 'canceled' | 'failed'
  createdAt: string
  startedAt?: string
  completedAt?: string
  progress?: {
    phase: string
    elapsedMs: number
    searchQueries: string[]
    thinkingExcerpts?: string[]
    findingsCount?: number
  }
  result?: {
    narrative: SearchRunNarrative
    results: SearchResultEntry[]
    tokenUsage: SearchTokenUsage
  }
  error?: { code: string; message: string; retriable: boolean }
  ttlAt: string
}
```

**Normalization updates** (`src/utils/searchExecutor.ts`):
- `normalizeRunNarrative()` — parse and validate model output against contract
- Assert minimum length for `executiveSummary`, `searchApproach`
- Assert `candidateEdge` is at least 2 sentences per result (heuristic: contains a `.` followed by prose)
- Flag contract violations on returned objects via a new `contractViolations?: string[]` field on SearchRun

All additions are backward-compatible (optional fields on existing types, new types purely additive). The `narrative` field on `SearchThesis` is new-required because theses are newly generated going forward — no existing thesis records to migrate.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 SearchRunNarrative interface defined with the 5-layer structure from the reference analysis (competitiveMoat, selectionMethodology, marketContext, executiveSummary, landscapeTrends) plus scoringRubric, laneSummaries, objectiveRecommendations, applicationPlan, visualizations, references, surprises, rejectedCandidates, nextSteps
- [ ] #2 ApplicationPlan type defined with phases and dated tasks
- [ ] #3 SearchRun extended with narrative?, jobId?, thesisId?, thesisSnapshot?, identityVersion?
- [ ] #4 SearchThesis extended with narrative: string (required)
- [ ] #5 ResearchJob type defined with all fields from doc-24 spec
- [ ] #6 normalizeRunNarrative() parses and validates AI output; returns undefined + contractViolations[] on malformed input
- [ ] #7 candidateEdge length assertion flags fragment-style responses (< 2 sentences)
- [ ] #8 Existing SearchResultEntry/SearchRun consumers compile without changes (all new narrative fields optional except where noted)
- [ ] #9 Mermaid source in visualizations is preserved verbatim (no re-serialization)
- [ ] #10 ApplicationPlan phases are validated against SearchTimeline.deadline when set
- [ ] #11 Type exports added to barrel files where needed
- [ ] #12 Unit tests cover each normalization branch and each contract violation case (missing layer, malformed applicationPlan, orphaned references)
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Shipped the type surface and normalization layer for the deep-research output contract.

**New types (`src/types/search.ts`):**

Run-level narrative structure matching doc-24's 5-layer contract:
- **Opening layers:** `competitiveMoat`, `selectionMethodology`, `marketContext`, optional `scoringRubric`
- **Lane structure:** optional `laneSummaries[]`
- **Closing layers:** optional `landscapeTrends`, `objectiveRecommendations[]`, `applicationPlan`, `visualizations[]`
- **Summary:** required `executiveSummary`
- **Feedback:** optional `surprises[]`, `rejectedCandidates[]`, `nextSteps[]`, `references[]`

Sub-types: `SearchNarrativeLaneSummary`, `SearchObjectiveRecommendation`, `SearchRejectedCandidate`, `SearchNarrativeReference`, `SearchVisualization` (with `SearchVisualizationType` = `'mermaid-gantt' | 'mermaid-xychart' | 'mermaid-other'`), `ApplicationPlan`, `ApplicationPlanPhase`, `ApplicationPlanTask`.

`ResearchJob` for TASK-161's durable async runner: status lifecycle (`queued | running | completed | canceled | failed`), immutable `thesisSnapshot`, `identityVersion` from TASK-159, progress streaming shape, terminal `ResearchJobResult`, retriable error classification, TTL.

**Type extensions:**
- `SearchRun` gains optional `narrative`, `jobId`, `thesisId`, `thesisSnapshot`, `identityVersion`, `contractViolations` — all backward-compatible.
- `SearchThesis` gains required `narrative: string` (no migration needed since SearchThesis has no persisted consumers yet).

**Normalization (`src/utils/searchExecutor.ts`):**
- `normalizeRunNarrative(value)` — returns `{ narrative?, violations[] }`. Returns `undefined` narrative when any of the 4 required layers is missing or empty. Flags length violations on required fields without rejecting the narrative. Parses optional layers best-effort, dropping malformed entries.
- `validateNarrativeCandidateEdges(results)` — heuristic sentence-count check against the 2-sentence minimum on `candidateEdge`.
- `validateApplicationPlanAgainstTimeline(plan, timeline?)` — flags tasks ending past `SearchTimeline.deadline`.
- `countSentences(text)` — exposed helper.
- Sub-normalizers for each nested structure.

**Design notes:**
- Mermaid source in `visualizations[].source` and `applicationPlan.mermaidDiagram` is preserved **verbatim** (no trim, no re-serialization) — Mermaid's leading/trailing blanks can be load-bearing.
- Unknown visualization types fall back to `'mermaid-other'` rather than being rejected — errs toward accepting model output.
- Contract thresholds (`MIN_PROSE_LENGTH = 40`, `MIN_EXECUTIVE_SUMMARY_LENGTH = 80`, `MIN_CANDIDATE_EDGE_SENTENCES = 2`) are weak-signal checks that catch fragment responses without rejecting terse legitimate narratives.
- `countSentences` intentionally over-counts on abbreviations ("Inc.", "e.g.") — biased toward accepting prose over rejecting legitimate multi-sentence content.

**Tests added (28):** all passing.

Commit: 08a3cd3 `feat(search): add SearchRunNarrative, ApplicationPlan, ResearchJob types + narrative normalizer`

Stats: 951 insertions across 3 files (188 in types, 375 in normalizer, 389 in tests). Test count: 1255 → 1283 (+28, all passing). The one pre-existing `searchExecutor.test.ts:405` failure (unrelated HTTP error message format) remains untouched.
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
