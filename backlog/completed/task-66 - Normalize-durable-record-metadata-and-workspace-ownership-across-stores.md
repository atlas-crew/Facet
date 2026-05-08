---
id: TASK-66
title: Normalize durable record metadata and workspace ownership across stores
status: Done
assignee:
  - '@codex'
created_date: '2026-03-11 17:40'
updated_date: '2026-03-11 19:16'
labels:
  - refactor
  - data-model
  - persistence
milestone: m-11
dependencies:
  - TASK-65
references:
  - src/types.ts
  - src/types/search.ts
  - src/store/resumeStore.ts
  - src/store/pipelineStore.ts
  - src/store/prepStore.ts
  - src/store/coverLetterStore.ts
  - src/store/searchStore.ts
documentation:
  - 'backlog://document/doc-5'
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prepare resume, pipeline, prep, cover-letter, and research persistence for multi-tenant storage by normalizing durable record metadata. The goal is to stop treating browser store blobs as anonymous local state and start treating them as workspace-scoped artifacts with stable IDs, schema versions, and timestamps.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Durable artifact types include or map cleanly to stable artifact IDs, workspace ownership, schema version, and revision/timestamp metadata needed for sync.
- [x] #2 The codebase clearly separates durable domain records from ephemeral UI/session state so only the intended data is prepared for sync/export.
- [x] #3 A migration strategy is defined for existing persisted records so current local users can upgrade without losing resume, pipeline, prep, letters, or research data.
- [x] #4 Cross-store identifiers and naming are aligned well enough that a unified snapshot/export format can reference them consistently.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented durable metadata normalization and workspace ownership scaffolding across resume, pipeline, prep, cover letter, and search records.
Added shared durable metadata helpers for ensure/create/touch/strip/timestamp normalization.
Exported direct migration helpers for cover letter, pipeline, prep, and search stores and added migration-focused regression coverage.
Addressed review feedback by normalizing pipeline durable metadata timestamps to full ISO values and centralizing inbound durableMeta patch stripping.
Verification:
- npm run typecheck
- npx vitest run src/test/coverLetterStore.test.ts src/test/pipelineStore.test.ts src/test/prepStore.test.ts src/test/searchStore.test.ts src/test/resumeStore.test.ts src/test/persistence.test.ts
- npx eslint src/store/durableMetadata.ts src/types/durable.ts src/persistence/contracts.ts src/store/coverLetterStore.ts src/store/pipelineStore.ts src/store/prepStore.ts src/store/resumeStore.ts src/store/searchStore.ts src/types.ts src/types/coverLetter.ts src/types/pipeline.ts src/types/prep.ts src/types/search.ts src/test/coverLetterStore.test.ts src/test/pipelineStore.test.ts src/test/prepStore.test.ts src/test/resumeStore.test.ts src/test/searchStore.test.ts
- npm run build
Review artifacts:
- .agents/reviews/review-20260311-151344.md
- .agents/reviews/test-audit-20260311-151344.md
Note: an earlier broad test-audit attempt against src/store exceeded the Claude budget; the final audit was rerun in narrow quick mode.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Normalized durable record metadata across the persisted Facet stores so resume, pipeline, prep, cover-letter, and search artifacts now carry workspace ownership, schema version, revision, and timestamp metadata needed for future sync work.

Added shared durable metadata helpers plus direct migration functions and regression coverage for the v1->v2 store upgrades, including invalid persisted-state fallbacks. Tightened the pipeline timestamp path so durable metadata uses full ISO timestamps instead of inheriting date-only pipeline fields.

Verification:
- npm run typecheck
- npx vitest run src/test/coverLetterStore.test.ts src/test/pipelineStore.test.ts src/test/prepStore.test.ts src/test/searchStore.test.ts src/test/resumeStore.test.ts src/test/persistence.test.ts
- npx eslint src/store/durableMetadata.ts src/types/durable.ts src/persistence/contracts.ts src/store/coverLetterStore.ts src/store/pipelineStore.ts src/store/prepStore.ts src/store/resumeStore.ts src/store/searchStore.ts src/types.ts src/types/coverLetter.ts src/types/pipeline.ts src/types/prep.ts src/types/search.ts src/test/coverLetterStore.test.ts src/test/pipelineStore.test.ts src/test/prepStore.test.ts src/test/resumeStore.test.ts src/test/searchStore.test.ts
- npm run build

Review artifacts:
- .agents/reviews/review-20260311-151344.md
- .agents/reviews/test-audit-20260311-151344.md
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [ ] #2 Documentation has been created/modified/removed as needed.
- [ ] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [ ] #4 Test changes were approved by a test gap analysis review
- [x] #5 Changes to integration points are covered by tests
- [x] #6 All tests pass successfully
- [ ] #7 Automatic formatting was applied.
- [x] #8 Linters report no WARNINGS or ERRORS
- [x] #9 The project builds successfully
<!-- DOD:END -->
