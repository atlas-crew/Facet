---
id: TASK-254
title: Refactor PrepCard to discriminated union keyed on `kind`
status: In Progress
assignee:
  - '@myself'
created_date: '2026-05-11 04:52'
updated_date: '2026-05-11 04:55'
labels:
  - prep
  - types
  - schema
  - refactor
milestone: m-32
dependencies: []
references:
  - src/types/prep.ts
  - src/utils/prepGenerator.ts
  - src/routes/prep/PrepCardView.tsx
  - src/test/prepGenerator.test.ts
  - src/test/PrepLiveMode.test.tsx
documentation:
  - 'backlog doc-28: Changes 2 (PrepCardKind) + 3 (discriminated union)'
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PrepCard in src/types/prep.ts is a single flat interface with ~10 optional fields covering every possible card shape (storyBlocks, followUps, deepDives, conditionals, metrics, tableData, storyVariants, pushbackScript, alternativeScript, keyPoints). This task replaces it with a TypeScript discriminated union keyed on a new `kind` field, per doc-28 Changes 2-3.

A `PrepCardKind` enum is added with members `'opener' | 'intel' | 'story' | 'anchor' | 'scenario' | 'deep-dive' | 'closer' | 'reference' | 'followup-qa'`. A `PrepCardBase` interface holds shared fields (id, deckId, category, title, tags, interviewerIds, source, vectorId, pipelineEntryId, perRoundState, script-related fields, etc.). One interface per kind extends `PrepCardBase` with only the fields that shape actually uses. Type guards (`isScenarioCard`, `isAnchorCard`, etc.) keep call sites readable.

PrepCardView dispatches on `card.kind` to per-kind renderer branches. Existing test fixtures and dev demo cards are migrated to declare `kind` explicitly in the same commit — pre-launch, no migration shims. The contract validator from TASK-170 is extended to enforce the `kind` discriminator and per-kind required fields.

This task does NOT introduce Scenario or Anchor visible behavior — it only lays the union foundation so dependent tasks (Scenario, Anchor, ScriptKind, Bookends, Sections) have a dispatcher to hook into. All existing cards become `kind: 'story'` (or the most-applicable existing kind) and continue rendering exactly as today.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 PrepCardKind type + PREP_CARD_KIND_VALUES const declared and exported from src/types/prep.ts
- [ ] #2 PrepCardBase interface holds all shared card fields (id, deckId, category, title, tags, interviewerIds, source, vectorId, pipelineEntryId, perRoundState, script, scriptLabel, updatedAt, etc.)
- [ ] #3 One interface per kind in the union; `kind` is required (no optional discriminator) on every card
- [ ] #4 PrepCard is exported as the discriminated union of all per-kind interfaces
- [ ] #5 Type guards (isStoryCard, isIntelCard, isOpenerCard, isCloserCard, isAnchorCard, isScenarioCard, isDeepDiveCard, isReferenceCard, isFollowUpQACard) exported from src/types/prep.ts
- [ ] #6 PrepCardView dispatches on card.kind to dedicated render branches (placeholder for kinds whose renderers ship in dependent tasks)
- [ ] #7 Existing test fixtures and dev demo cards updated to declare `kind` explicitly
- [ ] #8 validatePrepDeckOutput (TASK-170 contract validator) asserts `kind` is present and matches PREP_CARD_KIND_VALUES
- [ ] #9 prepGenerator.ts emits `kind` on every produced card; existing generation paths default to `kind: 'story'` until dependent tasks add deliberate kind selection
- [ ] #10 npm run typecheck passes with no `as` casts or `any` annotations introduced to silence the union
- [ ] #11 Regression tests cover the PrepCardView dispatch and the contract validator's kind-checking
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add the PrepCardKind discriminator, base interface, per-kind card interfaces, and exported type guards in src/types/prep.ts while preserving the current story-shaped fields for existing behavior.\n2. Update generator normalization and dev/test fixtures so every produced PrepCard declares an explicit kind, defaulting current generated cards to story unless the existing category clearly maps to opener/closer/intel.\n3. Update validatePrepDeckOutput to require kind and reject values outside PREP_CARD_KIND_VALUES.\n4. Add a kind-based PrepCardView dispatch wrapper with placeholder branches for future kind-specific renderers, while preserving current read-only/edit output.\n5. Add focused regression coverage for kind validation and renderer dispatch, then run format, focused tests, touched-file lint, typecheck/build as appropriate.\n6. Update TASK-254 acceptance criteria/DoD and commit only the touched task/code/test files with cortex git commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started TASK-254 from milestone m-32. Loaded agent-loops plus Facet placement, architecture, and persistence guidance. Scope is the union foundation only; no Scenario or Anchor visible behavior in this slice.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Regression tests pass (scoped to touched files)
- [ ] #5 Linters report no warnings or errors in touched files
- [ ] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
