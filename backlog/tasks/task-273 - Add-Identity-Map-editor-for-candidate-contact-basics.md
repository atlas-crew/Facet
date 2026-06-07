---
id: TASK-273
title: Add Identity Map editor for candidate contact basics
status: Done
assignee:
  - '@codex'
created_date: '2026-06-01 19:05'
updated_date: '2026-06-07 10:08'
labels:
  - feature
  - identity
milestone: m-35
dependencies: []
references:
  - TODO.md
  - src/routes/identity/IdentityMapPage.tsx
  - src/routes/identity/inspectorSlots/ProfileInspector.tsx
modified_files:
  - src/routes/identity/IdentityMapPage.tsx
  - src/routes/identity/IdentityInspector.tsx
  - src/routes/identity/identityMap.css
  - src/routes/identity/inspectorSlots/ContactBasicsInspector.tsx
  - src/types/identity.ts
  - src/utils/mapSelectionUrl.ts
  - src/store/identityStore.ts
  - src/test/IdentityMapEditing.test.tsx
  - src/test/mapSelectionUrl.test.ts
  - src/test/identityMapSelection.test.ts
priority: medium
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TODO.md reports that the Identity Map shows candidate name/contact/location at the top of /identity but provides no way to edit those candidate-only basics.

Placement: this is Identity-owned canonical candidate data. The editor should update currentIdentity.identity fields directly through existing Identity Map/inspector patterns; downstream resume, letter, research, prep, and debrief artifacts should continue to mirror Identity rather than own separate copies.

Scope notes:
- Cover name/display name, email/contact links, location, and remote/on-site preference where supported by the current ProfessionalIdentityV3 schema.
- Keep this on /identity; do not send users back to the import flow for durable edits.
- If a high-density editor is needed, reuse the existing inspector/sheet pattern rather than adding a second canonical surface.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Identity Map exposes an obvious edit path for candidate name, contact info, location, and supported availability/location basics.
- [x] #2 Saved edits update currentIdentity.identity canonically and are reflected in the Identity Map header without a page reload.
- [x] #3 The implementation preserves the Identity-as-canonical rule; downstream artifact surfaces mirror these values instead of adding duplicate editable copies.
- [x] #4 Focused tests cover editing and cancelling the profile/contact basics flow.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a Contact Basics inspector slot reachable from the Identity Map header. Saves canonical identity core contact fields, display title, remote availability, and contact links with validation, collision-safe link IDs, cancel/reset behavior, URL selection support, and focused coverage. Verification: npm run typecheck; npx vitest run src/test/IdentityMapEditing.test.tsx src/test/mapSelectionUrl.test.ts src/test/identityMapSelection.test.ts; npx eslint on touched TS/TSX files; agent-loop specialist review and focused test audit.
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
