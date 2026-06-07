---
id: TASK-272
title: Replace native clear-workspace confirm with shared in-app flow
status: To Do
assignee: []
created_date: '2026-06-01 14:40'
updated_date: '2026-06-07 02:44'
labels:
  - feature
  - remediation
milestone: m-36
dependencies: []
modified_files:
  - src/components/LocalWorkspaceDialog.tsx
  - src/components/HostedWorkspaceDialog.tsx
  - src/test/LocalWorkspaceDialog.test.tsx
  - src/test/HostedWorkspaceDialog.test.tsx
priority: low
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deferred from the clear-workspace review after aaa66c6. LocalWorkspaceDialog and HostedWorkspaceDialog both use native window.confirm for the destructive clear action, and they implement similar confirm/busy/success/error behavior separately. Replace the native confirm with a small in-app confirmation flow or shared clear-section primitive that matches the app modal style and keeps local/hosted behavior consistent.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Clear Workspace uses an in-app confirmation pattern instead of window.confirm.
- [ ] #2 Local and hosted dialogs share a common clear action component or hook for confirm, busy, success, and error behavior.
- [ ] #3 Tests cover confirm, cancel, success, error, and in-flight disabled behavior through Testing Library without mocking window.confirm.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Design a compact inline confirmation or shared modal-compatible clear section.\n2. Extract shared confirm/busy/feedback behavior for local and hosted dialogs.\n3. Remove window.confirm usage and update tests to interact with the in-app confirmation.\n4. Verify keyboard/focus and disabled-state behavior.
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
