---
id: TASK-102.6
title: Add parameters doc tab inside IdentityPage
status: Done
assignee: []
created_date: '2026-04-11 06:14'
updated_date: '2026-04-12 01:36'
labels:
  - feature
  - identity
  - research
milestone: m-16
dependencies:
  - TASK-102.3
  - TASK-102.4
  - TASK-102.5
references:
  - src/routes/identity/IdentityPage.tsx
  - src/routes/identity/ScannedIdentityEditor.tsx
documentation:
  - main/facet/identity-to-parameters-doc-spec
  - main/facet/job-search-parameters-method
parent_task_id: TASK-102
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a coherent parameters-doc section or tab inside IdentityPage that renders the strategic and factual identity fields as a unified artifact. This should be a view over identity, with section-level edit affordances that route users back to the relevant structured editors rather than creating a parallel editable document.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 IdentityPage includes a parameters-doc surface that renders constraints, filters, inventory, vectors, work history, and open questions from identity data.
- [ ] #2 The parameters-doc surface does not introduce its own durable store or document model.
- [ ] #3 Section-level edit affordances navigate back to the appropriate structured editor surfaces in IdentityPage.
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
