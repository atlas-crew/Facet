---
id: TASK-267
title: Remove legacy local backup and restore UX
status: Done
assignee:
  - '@codex'
created_date: '2026-05-29 01:29'
updated_date: '2026-05-29 01:38'
labels:
  - refactor
dependencies: []
priority: medium
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Hosted persistence has replaced the old localStorage-era encrypted backup/restore workflow as a normal product surface. Remove the visible backup/restore entry points and reminder UI without changing Facet workspace snapshots, persistence runtime contracts, hosted persistence, or migration behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 AppShell no longer exposes Backup Workspace actions, the Backup sidebar item, the encrypted backup dialog, or backup reminder banner in normal app flows.
- [x] #2 Legacy backup/restore UI component coverage is removed or replaced with coverage asserting the backup surface is absent where users previously reached it.
- [x] #3 Persistence snapshot/runtime internals, backup bundle helpers, import/export snapshot contracts, and hosted persistence behavior are left unchanged.
- [x] #4 Product-facing docs and feature references no longer present encrypted local backup/restore as the expected data-safety path.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Remove AppShell wiring for the legacy backup dialog/reminder and update AppShell tests around hosted recovery and sidebar actions.\n2. Delete obsolete backup/reminder UI components and their UI-only tests while leaving persistence/runtime helpers intact.\n3. Remove stale backup UI CSS and update product-facing docs/reference copy.\n4. Run focused tests, typecheck/lint/build, independent review/audit, then commit with cortex.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-05-29: Removed the legacy encrypted backup/restore product surface from AppShell, including the sidebar Backup action, hosted runtime recovery Backup Workspace action, backup reminder banner, dialog mount, obsolete backup UI components/tests, and stale backup CSS. Left persistence snapshot/runtime helpers, backup bundle internals, uiStore backup reminder fields, and hosted persistence contracts unchanged per TASK-267 scope. Updated hosted/user/developer docs away from local backup/restore as the product safety path. Verification passed: focused Vitest (AppShell, AppShellAdminNav, goldenDemoWorkspace, workspaceBackup, uiStore); npm run typecheck; targeted ESLint; format check; npm run build. Independent review: .agents/reviews/review-20260528-213551.md PASS WITH ISSUES with intentionally deferred persistence cleanup and a false-positive Cloud import note. Test audit: .agents/reviews/test-audit-20260528-213712.md no prioritized gaps.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed the legacy localStorage-era encrypted backup/restore UX while preserving persistence internals. AppShell no longer exposes Backup actions, the reminder banner, or the encrypted dialog; obsolete dialog/reminder components and UI tests were deleted; AppShell tests now assert the old surface is absent. Product and platform docs now describe hosted persistence, local-to-hosted migration, route-level exports, and hosted restore tooling instead of the global encrypted backup workflow. Verification passed with focused Vitest, typecheck, targeted ESLint, Prettier check, build, independent review, and diff test audit.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 Automatic formatting was applied to touched files
- [x] #4 Regression tests pass (scoped to touched files)
- [x] #5 Linters report no warnings or errors in touched files
- [x] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
