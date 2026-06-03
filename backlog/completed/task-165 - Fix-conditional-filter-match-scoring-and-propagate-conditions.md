---
id: TASK-165
title: >-
  Fix conditional filter match scoring and propagate conditions through search
  profile
status: Done
assignee:
  - '@codex'
created_date: '2026-04-19 09:30'
updated_date: '2026-05-08 05:08'
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
- [x] #1 normalizeSeverity() no longer collapses 'conditional' → 'soft' unconditionally
- [x] #2 Conditional avoid/prioritize entries apply match weight only when JD text satisfies the condition (substring keyword match for MVP)
- [x] #3 SearchProfileFilters type extended to preserve condition text and severity per entry (backward-compatible migration)
- [x] #4 identitySearchProfile adapter propagates condition text through to SearchProfile.filters
- [x] #5 Existing jobMatch tests pass; new tests cover: conditional match applied when condition keyword is in JD, conditional match NOT applied when absent, soft and hard paths unchanged
- [x] #6 Existing search prompts continue to work; flat string arrays are still producible for AI prompts that prefer them
- [x] #7 Store migration handles old persisted state without data loss
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Implement TASK-165 as a narrow Lane C slice: inspect current match scoring/profile/migration consumers; preserve conditional severity in jobMatch scoring with a simple condition-text keyword/substring heuristic; introduce structured SearchProfileFilterEntry plus compatibility helpers so prompt consumers can still get labels; migrate legacy string[] filters to structured entries; add focused tests for conditional apply/non-apply, hard/soft unchanged paths, adapter propagation, prompt compatibility, and legacy persisted state; run targeted tests plus typecheck/lint/build; update Backlog acceptance/DoD honestly and commit only TASK-165 files via cortex git commit.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented structured SearchProfileFilterEntry support so conditional prioritize/avoid entries retain label, condition, and severity through identity adaptation, persistence hydration, prompt payloads, and match scoring. Conditional scoring now applies only when the condition text matches the JD/search text, while hard and soft behavior remains unchanged. Added compatibility helpers for consumers that still need flat prompt labels.

Verification:
- npx vitest run src/test/jobMatch.test.ts src/test/identitySearchProfile.test.ts src/test/searchStore.test.ts src/test/deepSearchClient.test.ts src/test/searchExecutor.test.ts src/test/persistence.test.ts src/test/thesisGenerator.test.ts src/test/researchJobs.test.ts src/test/SearchInstancePreferences.editInIdentity.test.tsx src/test/ResearchPage.test.tsx (pass: 311 tests)
- npm run typecheck (pass)
- npm run build (pass; existing large chunk warnings)
- npx eslint proxy/researchJobs.js src/types/search.ts src/types/match.ts src/utils/searchProfileFilters.ts src/utils/searchAssumptions.ts src/utils/identitySearchProfile.ts src/utils/jobMatch.ts src/utils/deepSearchClient.ts src/utils/searchExecutor.ts src/utils/thesisGenerator.ts src/store/searchStore.ts src/routes/research/ResearchPage.tsx src/routes/research/searchWorkspaceComponents.tsx src/test/jobMatch.test.ts src/test/identitySearchProfile.test.ts src/test/searchStore.test.ts src/test/deepSearchClient.test.ts src/test/searchExecutor.test.ts src/test/persistence.test.ts src/test/thesisGenerator.test.ts src/test/researchJobs.test.ts src/test/SearchInstancePreferences.editInIdentity.test.tsx src/test/ResearchPage.test.tsx (pass)
- npm run format:files -- task/source/test files (pass)
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
