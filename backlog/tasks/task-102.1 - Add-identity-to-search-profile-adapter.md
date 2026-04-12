---
id: TASK-102.1
title: Add identity-to-search-profile adapter
status: Done
assignee: []
created_date: '2026-04-11 06:14'
updated_date: '2026-04-12 01:36'
labels:
  - feature
  - identity
  - research
milestone: m-16
dependencies: []
references:
  - src/routes/research/ResearchPage.tsx
  - src/utils/searchProfileInference.ts
  - src/utils/jobMatch.ts
  - src/identity/schema.ts
parent_task_id: TASK-102
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create the contract layer that maps Professional Identity into the shapes downstream search flows need. This adapter should translate identity-native skills, vectors, matching filters, constraints, and awareness items into research/search-facing structures without introducing a second canonical data model.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A dedicated adapter maps skills, vectors, matching filters, constraints, and awareness from Professional Identity into the search-facing structures Research needs.
- [ ] #2 The adapter preserves existing Match semantics for empty or missing search vectors, including graceful skill-first fallback behavior.
- [ ] #3 Adapter coverage includes focused tests for populated strategic fields and empty-strategy fallback cases.
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
