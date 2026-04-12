---
id: TASK-98.2
title: Normalize v3.1 extraction fields and reject legacy role_fit output
status: Done
assignee:
  - codex
created_date: '2026-04-09 23:45'
updated_date: '2026-04-12 00:22'
labels:
  - refactor
  - identity
  - extraction
  - v3-1
milestone: m-15
dependencies: []
documentation:
  - /Users/nick/Developer/Facet/src/utils/identityExtraction.ts
parent_task_id: TASK-98
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend normalizeExtractedIdentityCandidate so malformed or partial LLM responses are repaired into the expected v3.1 extraction shape.

This work should default missing search_vectors and awareness, normalize preferences.matching and preferences.constraints, and drop legacy preferences.role_fit if the model still emits it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Missing or invalid search_vectors normalize to an array.
- [x] #2 Missing or invalid awareness normalizes to { open_questions: [] }.
- [x] #3 Missing or invalid preferences.matching normalizes to { prioritize: [], avoid: [] } and missing subarrays are added.
- [x] #4 Legacy preferences.role_fit is removed during normalization with a warning instead of reaching the schema importer.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Accept native v3.1 extraction payloads in src/utils/identityExtraction.ts by repairing missing or invalid preferences.matching, preferences.constraints, search_vectors, and awareness before schema import.
Strip legacy preferences.role_fit from extraction payloads with an explicit warning so prompt output and normalization agree on the same contract.
Coordinate test updates with TASK-98.1 so prompt fixtures and normalization assertions move together in one atomic loop.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Normalization now covers schema_revision, native matching defaults, legacy role_fit migration, and importer compatibility. Current blocker is the last review pass requesting more resilient handling for partial matching rows and malformed search_vectors/awareness entries.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Normalized native v3.1 extraction payloads by defaulting missing search_vectors, awareness, preferences.matching, and constraints while stripping legacy role_fit during extraction repair. The completed slice shipped in commit 5f48748 with focused extraction, typecheck, and build receipts.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [ ] #2 Documentation has been created/modified/removed as needed.
- [ ] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [x] #4 Test changes were approved by a test gap analysis review
- [x] #5 Changes to integration points are covered by tests
- [x] #6 All tests pass successfully
- [ ] #7 Automatic formatting was applied.
- [ ] #8 Linters report no WARNINGS or ERRORS
- [x] #9 The project builds successfully
<!-- DOD:END -->
