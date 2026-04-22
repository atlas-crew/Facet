---
id: TASK-165
title: Fix conditional filter match scoring and propagate conditions through search profile
status: To Do
assignee: []
created_date: '2026-04-19 09:30'
labels:
  - search-redesign
  - match-scoring
  - identity-model
milestone: m-20
dependencies:
  - TASK-150
references:
  - src/utils/jobMatch.ts
  - src/utils/identitySearchProfile.ts
  - src/types/search.ts
  - src/types/match.ts
documentation:
  - 'backlog doc-24: Identity Model Gap Analysis, Gap 4'
  - 'backlog doc-26: Stage 3 Discovery Extraction'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-150 added `condition` fields to `preferences.matching.prioritize[]` and `avoid[]` with a new `'conditional'` severity, but `normalizeSeverity()` in `src/utils/jobMatch.ts` currently maps `'conditional'` → `'soft'`. That collapses the nuance: a conditional avoid ("K8s admin roles only") now uniformly down-weights any role mentioning K8s for match scoring, even roles that don't involve K8s admin work.

The AI side of the redesign is fine — Phase 1 (thesis) and Phase 2 (deep research) prompts now receive the condition text and can apply it (TASK-151.1 AC #1, TASK-151.2 AC #4). But the pipeline-side match scoring (used by `jobMatch.ts` for `PipelineEntry` match analysis) still loses the condition.

**Fix scope:**

1. **`jobMatch.ts` — preserve conditional severity as a distinct scoring category**
   - Add `'conditional'` to the `MatchSeverity` used internally (or treat conditional as "apply only if JD matches the condition")
   - When scoring a pipeline entry's JD against a conditional avoid/prioritize entry:
     - If the condition text matches the JD (heuristic keyword match or semantic check): apply the avoid/prioritize weight
     - If condition does not match: do not apply weight (treat as inapplicable)
   - Simpler MVP heuristic: case-insensitive substring match of condition keywords in JD text; semantic match is a later enhancement

2. **`identitySearchProfile.ts` — propagate condition text through the adapter**
   - Current `adaptIdentityToSearchProfile()` flattens matching filters to `{ prioritize: string[], avoid: string[] }` (just labels)
   - Extend `SearchProfileFilters` to preserve structured filter entries with condition:
     ```typescript
     interface SearchProfileFilterEntry {
       label: string
       condition?: string
       severity: 'hard' | 'soft' | 'conditional'
     }
     interface SearchProfileFilters {
       prioritize: SearchProfileFilterEntry[]
       avoid: SearchProfileFilterEntry[]
     }
     ```
   - Update adapter to pass through condition text
   - Update any consumers of the flat `string[]` shape (search prompt, tests)

3. **Migration in `searchStore`**
   - Persisted state with flat string arrays needs to migrate to the new shape
   - Backward-compatible hydrate: old `string[]` entries become `{ label, severity: 'soft' }` entries

**Why this matters beyond search:**
- Pipeline match scoring (jobMatch.ts) is used by the Pipeline workspace to score entries against the identity model. Without this fix, the match score for a role mentioning "Kubernetes" is silently wrong for users with conditional avoids.
- Cover letter generation and prep generation both read `preferences.matching` — the condition text should reach them for similar nuance.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 normalizeSeverity() no longer collapses 'conditional' → 'soft' unconditionally
- [ ] #2 Conditional avoid/prioritize entries apply match weight only when JD text satisfies the condition (substring keyword match for MVP)
- [ ] #3 SearchProfileFilters type extended to preserve condition text and severity per entry (backward-compatible migration)
- [ ] #4 identitySearchProfile adapter propagates condition text through to SearchProfile.filters
- [ ] #5 Existing jobMatch tests pass; new tests cover: conditional match applied when condition keyword is in JD, conditional match NOT applied when absent, soft and hard paths unchanged
- [ ] #6 Existing search prompts continue to work; flat string arrays are still producible for AI prompts that prefer them
- [ ] #7 Store migration handles old persisted state without data loss
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
