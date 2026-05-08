---
id: TASK-113
title: >-
  Preserve scanned identity skeleton when draft generation returns partial AI
  output
status: Done
assignee: []
created_date: '2026-04-12 14:30'
updated_date: '2026-04-12 14:45'
labels:
  - bug
  - identity
  - frontend
  - ai
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Draft generation currently accepts underspecified AI extraction output even when a scanned seed identity is present, which can collapse the draft to a fraction of the scanned roles and bullets while only surfacing normalization warnings. Preserve the scanned role/bullet structure when scan-backed generation returns a partial identity so the user does not lose parsed resume structure.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Scan-backed draft generation preserves scanned roles and bullets when the AI omits some of them
- [x] #2 The resulting draft keeps per-bullet draft entries for the full preserved role skeleton
- [x] #3 Existing identity extraction tests are updated to cover partial AI output with a scanned seed identity
- [x] #4 npm run typecheck, targeted vitest, and npm run build pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Adjusted scan-backed draft parsing to preserve the scanned identity skeleton when the AI returns a partial identity payload.
Seed merge now retains scanned identity core fields, roles, bullets, skill groups/items, projects, and education while overlaying non-empty AI enrichments.
generateIdentityDraft now passes seedIdentity through parseIdentityExtractionResponse so preservation occurs on the live generation path.
Added regression coverage for partial AI output collapsing a scanned draft and verified seeded contact fields plus omitted roles/bullets are retained.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Preserved scanned identity structure during draft generation when the AI returns partial extraction output, preventing scan-backed drafts from collapsing to a fraction of the parsed resume while still surfacing normalization warnings.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
