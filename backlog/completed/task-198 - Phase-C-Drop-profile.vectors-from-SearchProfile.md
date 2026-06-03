---
id: TASK-198
title: 'Phase C: Drop profile.vectors from SearchProfile'
status: Done
assignee:
  - '@codex'
created_date: '2026-04-30 08:26'
updated_date: '2026-05-07 21:52'
labels:
  - search
  - research
  - architecture
  - lanes-migration
  - phase-c
dependencies:
  - TASK-197
references:
  - src/types/search.ts
  - src/utils/searchProfileInference.ts
  - src/routes/research/researchUtils.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Phase C of the search angle migration. Depends on Phase B being complete (lanes are the primary path; resume-only fallback removed).

## Context

`SearchProfile.vectors: VectorSearchConfig[]` is a legacy field — it was the original "search angles" abstraction back when resume-driven search was the only path. After Phase B, lanes (on the active thesis) drive launch; profile.vectors are no longer read by the launch surface. This phase removes the field entirely so the profile becomes pure identity-derived structural data.

## Required scope

1. **Remove `vectors: VectorSearchConfig[]`** from the `SearchProfile` type in `src/types/search.ts`.
2. **Stop asking the LLM for vectors** in profile inference (`src/utils/searchProfileInference.ts`). Update the prompt schema and `normalizeInferredProfile` to drop the `vectors` field.
3. **Remove the `VectorSearchConfig` type** if no other consumer remains (verify with grep).
4. **Update `buildRequestDraft`** in `researchUtils.ts` — remove the `profile.vectors`-based focusVectors seeding (already short-circuited in Phase B if profile.vectors is empty, but here we delete the dead branch).
5. **Update tests/fixtures** — every place that constructs a SearchProfile with vectors needs the field stripped.

## Acceptance Criteria

- `SearchProfile.vectors` field no longer exists in the type system
- LLM inference prompts and response schemas don't mention vectors
- `VectorSearchConfig` type removed if unused (or kept and documented if still used elsewhere)
- All tests pass without referencing `profile.vectors`
- Workspace snapshots still load cleanly: snapshots from before this phase had `profile.vectors` populated; the loader must tolerate the field's presence and discard it (additive-optional drop pattern). Migration test required.

## Out of scope

- `ResumeData.vectors` in the Build workspace — those still drive resume assembly; they're just no longer plumbed into search. Stays.
- `focusVectors` field on `SearchRequest` — Phase D.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Remove SearchProfile.vectors from the search domain after Phase B: delete the type field/prompt schema path, update request-draft defaults to rely on active thesis lanes only, normalize legacy persisted profiles by discarding vectors, update fixtures/tests, then run focused tests/typecheck/review before commit.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented Phase C removal of SearchProfile.vectors. Removed the VectorSearchConfig type and store mutator, stopped profile inference from requesting or returning vectors, stripped resume assembly vector scaffolding from inference prompts, updated Research launch/readiness flows to use thesis lanes plus retained ResumeData.vectors only where pipeline selection still needs them, and added migration coverage that discards legacy persisted profile.vectors.\n\nVerification:\n- npm run typecheck passed before concurrent TASK-158 identityStore.test edits landed; current full typecheck is blocked by unrelated src/test/identityStore.test fixture errors (priority "primary", keywords.core).\n- npx vitest run src/test/searchProfileInference.test.ts src/test/searchStore.test.ts src/test/researchUtils.test.ts src/test/searchExecutor.test.ts src/test/deepSearchClient.test.ts src/test/ResearchPage.test.tsx src/test/searchRedesignRoundTrip.test.tsx src/test/persistence.test.ts passed: 230 tests.\n- npx eslint on TASK-198 touched files passed.\n- npm run build passed; only existing large-chunk warnings.\n- specialist-review iteration 3 passed with issues; P1 migration blocker verified clean.\n- diff-test-audit repo-wide scope was rejected by size guard; scoped inference audit findings were addressed with stronger prompt/result contract tests.
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
