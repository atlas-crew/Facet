---
id: TASK-108
title: Collapse scanned skill sections in Identity scan editor
status: Done
assignee: []
created_date: '2026-04-12 05:46'
updated_date: '2026-04-12 06:04'
labels:
  - feature
  - identity
  - ux
  - frontend
dependencies: []
references:
  - ./src/routes/identity/ScannedIdentityEditor.tsx
  - ./src/test/IdentityPage.test.tsx
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make the scanned Skills section on the Identity page easier to scan by collapsing each parsed skill group behind an explicit toggle while keeping inline editing available when expanded.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Parsed skill groups in the scanned Identity editor render in collapsible sections instead of always-expanded cards.
- [x] #2 The collapsed state still makes each group label and item count discoverable at a glance.
- [x] #3 Expanded sections preserve the existing inline editing affordances for group labels and individual skills.
- [x] #4 Existing relevant Identity page tests are updated or extended for the new collapse behavior.
- [x] #5 npm run build passes for this slice.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update ScannedIdentityEditor so each parsed skill group renders as a collapsible section with a compact header showing the group label and skill count. 2. Keep the group label input and per-skill inline editors inside the expanded body so existing editing affordances stay intact. 3. Add or extend one focused IdentityPage test that uploads a scanned resume, verifies the skills body starts collapsed, and confirms expanding a group reveals the editable inputs. 4. Run targeted identity-page tests plus lint and build before review/commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented collapsible scanned skill groups in ScannedIdentityEditor with compact headers showing group name and skill count, plus aria-expanded and aria-controls on the toggle.

Kept inline group-label and skill-item editors inside the expanded panel and matched the role accordion accessibility pattern by giving role toggles stable aria-controls targets.

Independent review artifacts: .agents/reviews/review-20260412-020250.md and .agents/reviews/test-audit-20260412-015537.md.

Verification: npx vitest run src/test/IdentityPage.test.tsx; npm run typecheck; npm run build; npm run test.

Targeted eslint still reports pre-existing react-hooks/set-state-in-effect errors in untouched ScannedIdentityEditor effect logic at lines 444, 456, and 474, so DoD lint item remains unchecked for this slice.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Collapsed scanned skill groups in the Identity scan editor behind compact toggles, preserved inline editing when expanded, extended IdentityPage coverage for the collapsed/expanded flow, and verified with targeted vitest, full npm run test, typecheck, and build. Committed as 9c35c5d.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
