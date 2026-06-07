---
id: TASK-268.2
title: Add determinate progress UI for Deepen all bullets
status: Done
assignee: []
created_date: '2026-05-31 20:48'
updated_date: '2026-06-07 07:58'
labels:
  - feature
  - identity
  - import
  - progress
milestone: m-35
dependencies: []
references:
  - TODO.md
modified_files:
  - src/routes/identity/ExtractionAgentCard.tsx
  - src/routes/identity/identity.css
  - src/store/identityStore.ts
  - src/types/identity.ts
  - src/utils/resumeScanner/pdf.ts
  - src/test/IdentityPage.test.tsx
  - src/test/identityStore.test.ts
  - src/test/HomePage.test.tsx
  - src/test/BulletInspector.sheet.test.tsx
  - src/test/intakeSynthesis.test.ts
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
- [x] #1 When bulkStatus is running or cancelling, the import card renders a determinate progress bar based on completed/total.
- [x] #2 The UI names the current bullet or role being processed when currentBulletKey can be resolved.
- [x] #3 Completed, failed, and remaining counts are visible without waiting for the final toast.
- [x] #4 Cancel state remains clear and accessible.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reuse existing scanResult.progress.bulk rather than adding new long-lived state.
2. Resolve currentBulletKey to a readable role/bullet summary in ExtractionAgentCard.
3. Add an accessible progressbar with aria-valuenow/min/max and concise status text.
4. Cover running, cancelling, partial failure, and idle states in IdentityPage tests.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added determinate bulk deepen progress with current-bullet context, completed/failed/remaining counts, cancellation state, persisted failure baselines, and focused UI/store coverage. Verification: npm run typecheck; npx vitest run src/test/IdentityPage.test.tsx src/test/identityStore.test.ts src/test/HomePage.test.tsx src/test/BulletInspector.sheet.test.tsx src/test/intakeSynthesis.test.ts; npx eslint on touched TS/TSX files.
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
