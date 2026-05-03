---
id: TASK-198
title: 'Phase C: Drop profile.vectors from SearchProfile'
status: To Do
assignee: []
created_date: '2026-04-30 08:26'
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

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
