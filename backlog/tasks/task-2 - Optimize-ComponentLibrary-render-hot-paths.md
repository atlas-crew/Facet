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
- [x] #3 No behavior regressions in toggles/reordering/variant switching
- [x] #4 Verification commands pass
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

Completed TASK-2 implementation. Stabilized BuildPage empty override/order fallbacks for active and comparison vectors; memoized ComponentLibrary ordered roles and order metadata; memoized BulletList per-role inclusion, variant, display-text maps and virtualized render callbacks; preserved default bullet-order identity for missing/empty vector orders; added focused regression coverage for hot-path prop stability, ordering metadata, inclusion precedence, variant reset behavior, and bullet-order sentinels. Independent source reviews and split test audits are clean. Verification: npm run typecheck; focused vitest hot-path suite; scoped eslint; touched-file format check; npm run lint; npm run test; npm run build.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Optimized the Build -> ComponentLibrary -> BulletList render hot path by replacing fresh empty fallbacks with frozen sentinels, preserving bullet-order object identity where possible, memoizing per-role ordered roles/order metadata, and moving BulletList row derivations/render callbacks behind stable memoized inputs. Added focused coverage for stable BuildPage props including comparison mode, ComponentLibrary order metadata/reference preservation, BulletList inclusion/variant behavior, and bullet-order sentinel/default identity behavior. Verification passed: npm run typecheck; focused vitest suite; scoped eslint; touched-file format check; npm run lint; npm run test; npm run build. Independent specialist review and split test audits are clean.
<!-- SECTION:FINAL_SUMMARY:END -->
