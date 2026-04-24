---
id: TASK-87
title: Align scan store field typing and normalization conventions
status: To Do
assignee: []
created_date: '2026-04-07 05:00'
labels:
  - scanner
dependencies: []
references:
  - ./.agents/reviews/review-20260407-005752.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deferred from source review artifact ./.agents/reviews/review-20260407-005752.md.

Findings bundled into this task:
- P2-001: align scanned updater field typing safety between project and education editors
- P2-002: make optional-field normalization rule explicit and extensible for scanned project fields
- P3-001: normalize or document primary scan count ordering for easier debugging
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Scanned project and education updater field types are derived from the schema rather than freestanding literal unions or broad keyof usage.
- [ ] #2 Optional scanned field normalization is handled through a named shared helper or explicit optional-field table.
- [ ] #3 Scan count ordering is either standardized across the object or documented inline where it is intentionally non-alphabetical.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Introduce a typed editable-field alias for scanned education entries.
2. Replace ad hoc optional-field checks with a small shared normalizer or optional-field set.
3. Decide whether scan count ordering should be standardized or documented, then apply the chosen convention.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Documentation has been created/modified/removed as needed.
- [ ] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [ ] #4 Test changes were approved by a test gap analysis review
- [ ] #5 Changes to integration points are covered by tests
- [ ] #6 All tests pass successfully
- [ ] #7 Automatic formatting was applied.
- [ ] #8 Linters report no WARNINGS or ERRORS
- [ ] #9 The project builds successfully
<!-- DOD:END -->
