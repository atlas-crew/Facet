---
id: TASK-2
title: Optimize ComponentLibrary render hot paths
status: In Progress
assignee:
  - '@codex'
created_date: '2026-02-28 05:46'
updated_date: '2026-05-28 17:09'
labels:
  - remediation
  - performance
dependencies:
  - TASK-1
references:
  - .agents/reviews/review-20260227-175002.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Specialist review notes avoidable re-renders from per-role derived maps and unstable references in the library tree. Apply targeted memoization and stable props after architecture refactor lands.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Derived per-role inclusion/variant maps are not recreated on unrelated renders
- [x] #2 Assembly memo dependencies do not invalidate on fresh empty-object literals
- [ ] #3 No behavior regressions in toggles/reordering/variant switching
- [ ] #4 Verification commands pass
<!-- AC:END -->





## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Profile current render path for ComponentLibrary/BulletList with medium dataset.
2. Memoize includedByBulletId and variantByBulletId per role or move derivation into children with stable inputs.
3. Avoid recreating empty-object fallbacks in memo dependencies.
4. Verify no regressions via lint/typecheck/test/build.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Starting TASK-2 after closing TASK-1. I will target the Build -> ComponentLibrary -> BulletList hot path: stabilize empty override/order fallbacks, avoid fresh comparison assembly dependency objects, memoize role-level bullet derivations, and keep behavior verified with focused tests plus lint/typecheck/build.
<!-- SECTION:NOTES:END -->
