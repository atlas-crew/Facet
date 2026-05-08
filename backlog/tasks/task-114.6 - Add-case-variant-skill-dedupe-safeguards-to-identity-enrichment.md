---
id: TASK-114.6
title: Add case-variant skill dedupe safeguards to identity enrichment
status: In Progress
assignee:
  - '@codex'
created_date: '2026-04-12 23:48'
updated_date: '2026-05-08 21:10'
labels:
  - identity
  - skill-enrichment
  - data-integrity
dependencies: []
references:
  - src/utils/identityEnrichment.ts
  - src/store/identityStore.ts
modified_files:
  - src/identity/skillDedupe.ts
  - src/identity/schema.ts
  - src/utils/identityEnrichment.ts
  - src/test/identityEnrichmentDedupe.test.ts
parent_task_id: TASK-114
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Protect identity enrichment from case-variant duplicate skill names inside a single group by adding a load/import dedupe or migration path before normalized skill-name matching can touch multiple records.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Case-variant duplicate skills within the same group are detected during load or import.
- [x] #2 The app either dedupes those records safely or surfaces a repair path before enrichment updates run.
- [x] #3 Regression coverage documents the chosen behavior.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect the identity enrichment and identity store skill matching flow, including current casing conventions.\n2. Add a narrow case-insensitive dedupe safeguard at the load/import or enrichment boundary without disturbing unrelated TASK-89 scan persistence work.\n3. Add focused regression tests for case-only duplicate skills and canonical casing preservation.\n4. Run targeted tests plus type/lint/build gates, then update Backlog evidence and commit via cortex git commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-05-08 TASK-114.6 evidence:
- Added group-scoped case/trim-insensitive skill dedupe during identity import/runtime normalization via src/identity/skillDedupe.ts and src/identity/schema.ts.
- Enrichment updates now defensively repair stale case-variant duplicates before applying a skill update in src/utils/identityEnrichment.ts.
- Canonical casing is first-seen canonical casing; duplicate tags/status/depth metadata merge without allowing undefined duplicate depth to erase canonical depth.
- Focused regression coverage added in src/test/identityEnrichmentDedupe.test.ts for import/runtime dedupe, canonical casing, enrichment-update repair, status/depth tie-breaks, empty-name preservation, and cross-group separation.
- Verification passed: npm run format:files -- src/test/identityEnrichmentDedupe.test.ts; npm run test -- src/test/identityEnrichmentDedupe.test.ts; npm run typecheck; npx eslint src/identity/skillDedupe.ts src/utils/identityEnrichment.ts src/identity/schema.ts src/test/identityEnrichmentDedupe.test.ts; npm run build.
- Repo-wide npm run test is blocked by unrelated existing failures outside this lane: IdentityMapEditing, PrepPage behavior, facetServer persistence endpoints, jdAnalysis deleteEntry expectations, searchRedesignRoundTrip router setup, and workspaceBackup thesis reflection expectations.
- Repo-wide npm run lint is blocked by unrelated existing/generated lint failures, including .vercel/output/dist artifacts and pre-existing source/test lint debt.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
