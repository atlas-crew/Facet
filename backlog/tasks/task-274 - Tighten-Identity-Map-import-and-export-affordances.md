---
id: TASK-274
title: Tighten Identity Map import and export affordances
status: To Do
assignee: []
created_date: '2026-06-01 19:05'
updated_date: '2026-06-07 02:44'
labels:
  - feature
  - identity
milestone: m-35
dependencies: []
references:
  - TODO.md
  - src/routes/identity/IdentityMapPage.tsx
  - src/routes/identity/IdentityPage.tsx
priority: low
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TODO.md calls out two Identity Map action gaps: the topbar action still says "Import from resume" even though the import flow now accepts multiple identity source types, and /identity lacks an Export Identity button.

Placement: this is Identity workspace chrome. Import should keep routing to /identity/import, but the label should no longer imply resume-only input. Export should serialize the current canonical identity model, not a resume projection or scan-staging draft.

Scope notes:
- Use concise product copy such as "Import" or "Load context" after checking surrounding Identity copy.
- Add export from /identity only when currentIdentity exists; disabled/empty-state behavior should be explicit.
- Prefer existing JSON download helpers/patterns already used in the import workspace.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The /identity topbar import action uses source-generic copy and still routes to /identity/import.
- [ ] #2 The /identity topbar exposes an Export Identity action when a canonical identity exists.
- [ ] #3 The export downloads the canonical ProfessionalIdentity JSON with a predictable filename and does not export resume config or scan-only staging data.
- [ ] #4 Focused tests cover the generic import label and export action availability/behavior.
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
