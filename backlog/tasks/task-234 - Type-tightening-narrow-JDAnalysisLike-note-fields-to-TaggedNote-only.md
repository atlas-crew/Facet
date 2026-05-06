---
id: TASK-234
title: 'Type tightening: narrow JDAnalysisLike note fields to TaggedNote[] only'
status: To Do
assignee: []
created_date: '2026-05-06 20:28'
labels:
  - audience-tagging
  - types
  - tech-debt
milestone: m-28
dependencies: []
references:
  - src/utils/audienceRules.ts
  - src/store/jdAnalysisStore.ts
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

`JDAnalysisLike` (in `src/utils/audienceRules.ts`) accepts `TaggedNote[] | string[]` for `warnings`, `strengthsToLead`, `gapFocus`, and `positioningRecommendations`. The union exists to support legacy-string hydration during migration.

Once all callers produce `TaggedNote[]` (post-Phase-7), the union is dead weight and a footgun: future code can accidentally introduce string-array notes and the type will silently accept them. The runtime `isTaggedNoteArray` shape check (added in TASK-226) becomes redundant once the type forbids the bad case at compile time.

## What

- Audit all callers of `applyRulesBasedAudiences` and `JDAnalysisLike` to confirm they produce `TaggedNote[]`
- Drop `string[]` from the union in `JDAnalysisLike`
- Simplify `tagNotes` to no longer handle string entries
- Remove `trimWarningNotes`'s string branch in `jdAnalysisStore.ts` (post-migration, persisted records are already TaggedNote[])
- The `isTaggedNoteArray` runtime check in the idempotency guard can simplify or be removed

## Acceptance criteria

- JDAnalysisLike note fields are TaggedNote[] only
- All call sites compile under the narrower type
- Migration test for legacy strings stays green (the migration path is the only place strings can enter, and it converts via `untaggedNote()`)
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
