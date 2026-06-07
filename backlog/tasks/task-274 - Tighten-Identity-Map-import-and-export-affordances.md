---
id: TASK-274
title: Tighten Identity Map import and export affordances
status: Done
assignee: []
created_date: '2026-06-01 19:05'
updated_date: '2026-06-07 05:57'
labels:
  - feature
  - identity
milestone: m-35
dependencies: []
references:
  - TODO.md
  - src/routes/identity/IdentityMapPage.tsx
  - src/routes/identity/IdentityPage.tsx
modified_files:
  - src/routes/identity/IdentityMapPage.tsx
  - src/test/IdentityMapPage.deepLink.test.tsx
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
- [x] #1 The /identity topbar import action uses source-generic copy and still routes to /identity/import.
- [x] #2 The /identity topbar exposes an Export Identity action when a canonical identity exists.
- [x] #3 The export downloads the canonical ProfessionalIdentity JSON with a predictable filename and does not export resume config or scan-only staging data.
- [x] #4 Focused tests cover the generic import label and export action availability/behavior.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Renamed the Identity Map import affordance to source-generic copy and added a canonical ProfessionalIdentity JSON export action gated on currentIdentity. Export filenames derive from the identity name with safe slug fallback, object URLs are cleaned up on repeat/unmount/timer paths, success and failure notices use appropriate live-region roles, and focused tests cover availability, filenames, blob content, errors, cleanup, and notice dismissal. Verification: npx vitest run src/test/IdentityMapPage.deepLink.test.tsx; npx eslint src/routes/identity/IdentityMapPage.tsx src/test/IdentityMapPage.deepLink.test.tsx; npm run typecheck; agent-loop source review PASS WITH ISSUES no P0/P1; diff test audit no P0/P1.
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
