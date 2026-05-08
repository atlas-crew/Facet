---
id: TASK-26
title: Define PrepCard types and create sample data with import/export flow
status: Done
assignee: []
created_date: '2026-03-07 12:00'
updated_date: '2026-03-08 09:16'
labels: []
milestone: m-4
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Define the PrepCard data model and build the import/export infrastructure for prep data. The prep feature ships empty — real interview prep content (scripts, positioning, project details) is personal data that must never be committed to the repo. Users import their own prep data via JSON. Create fictional sample data for development and testing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All types defined in `src/types/prep.ts` per spec (PrepCard, PrepCategory, PrepFollowUp, PrepDeepDive, PrepMetric)
- [x] #2 `src/routes/prep/samplePrepData.ts` contains 3-5 **fictional** PrepCard entries demonstrating each content block type (script, followUp, deepDive, metrics, table). Zero real company names, project details, or interview scripts.
- [x] #3 Import function: accepts a JSON file, validates it conforms to `PrepCard[]` schema, and loads into state
- [x] #4 Export function: dumps current cards to downloadable JSON
- [x] #5 Prep data persisted to localStorage via Zustand store (key: `facet-prep-data`) OR loaded fresh from file — decide based on expected data size
- [x] #6 Empty state when no data loaded: shows Import JSON + Load Sample Data buttons
- [x] #7 Categories properly typed per mockup: `'opener' | 'behavioral' | 'technical' | 'project' | 'metrics' | 'situational'`
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create `src/types/prep.ts` with types from spec §4.1.
2. Create `src/routes/prep/samplePrepData.ts` with fictional entries. Examples:
   - An "opener" card: "Tell me about yourself" with a generic script and warning
   - A "project" card: "Project Alpha — Performance Optimization" with fictional followUps and metrics
   - A "deep-dive" card demonstrating the deepDives and tableData blocks
   - A "numbers" card with fictional metrics
3. Create a `prepStore` (Zustand persist, key `facet-prep-data`) or decide on file-based loading.
4. Implement import validation: check array shape, required fields (id, category, title), and warn on missing optional fields.
5. Implement export as JSON download.
6. The extraction mapping table in spec §4.2 is reference for the USER to migrate their own data from the HTML file — it is NOT an instruction to extract real data into source.
7. Reference: `docs/PIPELINE_PREP_SPEC.md` §4.1–§4.2.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All PrepCard types defined in `src/types/prep.ts`. Sample data with 5 fictional cards in `samplePrepData.ts`. Import validation via `src/utils/prepImport.ts` (structural validation, 2MB size limit, field coercion). Export as JSON download. Persisted to localStorage under `facet-prep-data`. Empty state with Import + Load Sample buttons. Categories typed as union type.
<!-- SECTION:FINAL_SUMMARY:END -->
