---
id: TASK-114.5
title: Make skill lists editable from the enrichment overview
status: Done
assignee: []
created_date: '2026-04-12 23:18'
updated_date: '2026-04-12 23:48'
labels:
  - identity
  - skill-enrichment
  - frontend
dependencies: []
references:
  - src/routes/identity/IdentityEnrichmentPage.tsx
  - src/store/identityStore.ts
  - src/test/IdentityEnrichmentPage.test.tsx
parent_task_id: TASK-114
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Allow users to add missing skills to existing groups and remove unwanted skills directly from the enrichment overview so the wizard queue can be corrected without leaving the flow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The enrichment overview lets users add a skill to an existing skill group.
- [x] #2 The enrichment overview lets users remove a skill from the queue with confirmation.
- [x] #3 Added skills appear in the correct list status and persist to the current identity.
- [x] #4 The overview prevents duplicate skills within the same group.
- [x] #5 Existing overview tests are updated to cover add and remove behavior.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added skill-list management to the enrichment overview. Users can add a skill to an existing group, remove a skill with confirmation, and duplicate prevention now uses normalized skill-name matching. The overview tests and store tests were expanded for add/remove flows, duplicate blocking, and case-insensitive enrichment updates.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
