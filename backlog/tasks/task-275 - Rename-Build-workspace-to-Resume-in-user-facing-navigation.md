---
id: TASK-275
title: Rename Build workspace to Resume in user-facing navigation
status: To Do
assignee: []
created_date: '2026-06-01 19:05'
updated_date: '2026-06-07 02:44'
labels:
  - feature
  - build
  - copy
milestone: m-36
dependencies: []
references:
  - TODO.md
  - src/components/AppShell.tsx
  - src/routes/build/BuildPage.tsx
  - src/routes/home/HomePage.tsx
  - src/routes/help/HelpPage.tsx
priority: low
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TODO.md asks for the /build page to be renamed "Resume". The route can remain /build unless product explicitly asks for a route migration; this task is the user-facing naming pass.

Placement: Build owns pure resume editing/assembly, but the visible workspace label should match the product language "Resume". Keep architecture notes intact: the workspace still consumes pipeline/identity context and does not originate job-context generation.

Scope notes:
- Audit app shell navigation, home entry cards, help guide section labels/titles, route headings, aria labels, and cross-workspace buttons that say Build/Builder.
- Preserve technical identifiers and route paths unless they are directly user-facing.
- Avoid changing docs that intentionally discuss historical architecture unless a user-facing guide would become stale.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Primary navigation and workspace chrome present /build as Resume rather than Build.
- [ ] #2 User-facing helper copy, buttons, and help-guide labels that refer to the workspace are audited and updated where appropriate.
- [ ] #3 The /build route path and existing handoff behavior continue to work unless an explicit route-migration decision is added.
- [ ] #4 Focused tests or snapshots cover the renamed navigation/header copy on the main app surfaces.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Regression tests pass (scoped to touched files)
- [ ] #5 Linters report no warnings or errors in touched files
- [ ] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
