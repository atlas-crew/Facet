---
id: TASK-5
title: Expand assembler/page-budget test coverage for edge behavior
status: In Progress
assignee:
  - '@codex'
created_date: '2026-02-28 05:46'
updated_date: '2026-05-28 20:01'
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
Test audit identified untested edge behavior in engine assembly and page-budget estimation. Add focused tests for ordering, all-vector logic, passthrough contracts, and line-estimation boundaries.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Line-estimation functions are directly covered for key boundary cases
- [ ] #2 Assembler covers skill ordering and profile/override edge selection
- [ ] #3 Header and education passthrough are asserted
- [ ] #4 Verification commands pass
<!-- AC:END -->



## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add direct tests for estimateResumeLines/estimateWrappedLines boundary conditions.
2. Add assembler tests for skill-group ordering, profile priority selection, partial bullet-order maps, and header/education passthrough.
3. Add override precedence tests for key specificity.
4. Run lint/typecheck/test/build.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Starting TASK-5. I will keep this to focused engine test hardening: inspect existing assembler/page-budget coverage, add boundary tests for line estimation/page usage, assembly edge tests for skill ordering/profile/override/passthrough behavior, run focused and full verification, then request independent diff test audit before closeout.
<!-- SECTION:NOTES:END -->
