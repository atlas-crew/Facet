---
id: TASK-268.2
title: Add determinate progress UI for Deepen all bullets
status: To Do
assignee: []
created_date: '2026-05-31 20:48'
labels:
  - feature
  - identity
  - import
  - progress
dependencies: []
references:
  - TODO.md
modified_files:
  - src/routes/identity/ExtractionAgentCard.tsx
  - src/store/identityStore.ts
  - src/test/IdentityPage.test.tsx
parent_task_id: TASK-268
priority: medium
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deepen all bullets already tracks bulk status, total, completed, currentBulletKey, and failures in identityStore. The current import UI shows counts and changes the button label to Deepening, but TODO requests an explicit progress bar while the long-running bulk action works through bullets.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 When bulkStatus is running or cancelling, the import card renders a determinate progress bar based on completed/total.
- [ ] #2 The UI names the current bullet or role being processed when currentBulletKey can be resolved.
- [ ] #3 Completed, failed, and remaining counts are visible without waiting for the final toast.
- [ ] #4 Cancel state remains clear and accessible.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reuse existing scanResult.progress.bulk rather than adding new long-lived state.
2. Resolve currentBulletKey to a readable role/bullet summary in ExtractionAgentCard.
3. Add an accessible progressbar with aria-valuenow/min/max and concise status text.
4. Cover running, cancelling, partial failure, and idle states in IdentityPage tests.
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
