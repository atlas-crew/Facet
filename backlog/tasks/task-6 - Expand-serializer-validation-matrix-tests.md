---
id: TASK-6
title: Expand serializer validation matrix tests
status: In Progress
assignee:
  - '@codex'
created_date: '2026-02-28 05:46'
updated_date: '2026-05-25 14:01'
labels:
  - remediation
  - testing
dependencies: []
references:
  - .agents/reviews/test-audit-20260227-173406.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Test audit flagged shallow coverage across serializer field validation. Build a compact matrix of malformed input cases to validate required nested fields and object-shape guards.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Serializer rejects malformed nested records for vectors/projects/bullets/education
- [ ] #2 Serializer rejects non-object roots and invalid skill order values
- [ ] #3 Round-trip/fallback tests remain passing
- [ ] #4 Verification commands pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add targeted failing fixtures for vectors/projects/bullets/education missing required fields.
2. Add tests for non-object roots and invalid skill order values.
3. Keep error assertions path-specific where practical.
4. Run lint/typecheck/test/build.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-05-25 Codex starting TASK-6 in branch codex/task-6. Plan: expand serializerValidation matrix around malformed nested records and object-shape guards for vectors/projects/bullets/education, add root non-object variants and invalid skill order shape/value assertions, run focused serializer tests plus lint/typecheck/build gates, run independent review/audit fallback if needed, commit with cortex git commit and close with receipts.
<!-- SECTION:NOTES:END -->
