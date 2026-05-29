---
id: TASK-267
title: Remove legacy local backup and restore UX
status: To Do
assignee: []
created_date: '2026-05-29 01:29'
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
- [ ] #1 AppShell no longer exposes Backup Workspace actions, the Backup sidebar item, the encrypted backup dialog, or backup reminder banner in normal app flows.
- [ ] #2 Legacy backup/restore UI component coverage is removed or replaced with coverage asserting the backup surface is absent where users previously reached it.
- [ ] #3 Persistence snapshot/runtime internals, backup bundle helpers, import/export snapshot contracts, and hosted persistence behavior are left unchanged.
- [ ] #4 Product-facing docs and feature references no longer present encrypted local backup/restore as the expected data-safety path.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Remove AppShell wiring for the legacy backup dialog/reminder and update AppShell tests around hosted recovery and sidebar actions.\n2. Delete obsolete backup/reminder UI components and their UI-only tests while leaving persistence/runtime helpers intact.\n3. Remove stale backup UI CSS and update product-facing docs/reference copy.\n4. Run focused tests, typecheck/lint/build, independent review/audit, then commit with cortex.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Regression tests pass (scoped to touched files)
- [ ] #5 Linters report no warnings or errors in touched files
- [ ] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
