---
id: TASK-104
title: Add schema import security and validation test coverage
status: To Do
assignee: []
created_date: '2026-04-12 01:37'
labels:
  - tests
  - identity
  - security
dependencies: []
references:
  - src/identity/schema.ts
  - .agents/reviews/test-audit-20260411-213121.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add dedicated schema tests for importProfessionalIdentity and looksLikeProfessionalIdentity so validation, unique-ID guards, and prototype-pollution protection stay covered independently of page-level tests.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Schema tests cover required fields, version and schema_revision validation, enum validation, duplicate ID rejection, and global bullet ID uniqueness.
- [ ] #2 Schema tests cover __proto__, prototype, and constructor rejection.
- [ ] #3 Schema tests cover looksLikeProfessionalIdentity and tag-normalization warnings.
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
