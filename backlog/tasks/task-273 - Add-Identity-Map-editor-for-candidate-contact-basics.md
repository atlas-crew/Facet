---
id: TASK-273
title: Add Identity Map editor for candidate contact basics
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
  - src/routes/identity/inspectorSlots/ProfileInspector.tsx
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
- [ ] #1 Identity Map exposes an obvious edit path for candidate name, contact info, location, and supported availability/location basics.
- [ ] #2 Saved edits update currentIdentity.identity canonically and are reflected in the Identity Map header without a page reload.
- [ ] #3 The implementation preserves the Identity-as-canonical rule; downstream artifact surfaces mirror these values instead of adding duplicate editable copies.
- [ ] #4 Focused tests cover editing and cancelling the profile/contact basics flow.
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
