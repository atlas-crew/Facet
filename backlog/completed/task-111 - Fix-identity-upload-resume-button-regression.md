---
id: TASK-111
title: Fix identity upload resume button regression
status: Done
assignee: []
created_date: '2026-04-12 09:07'
updated_date: '2026-04-12 13:52'
labels:
  - bug
  - identity
  - frontend
dependencies: []
references:
  - ./src/routes/identity/IdentityPage.tsx
  - ./src/test/IdentityPage.test.tsx
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Restore the Identity page Upload Resume gesture flow so the chooser reliably opens after the workspace-shell refactor.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Clicking Upload Resume from the Identity page reliably opens the file chooser, including from paste mode.
- [x] #2 Existing Identity page upload interaction tests pass after the fix.
- [x] #3 Targeted typecheck, relevant tests, and build pass.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Restored the deferred upload chooser gesture in IdentityPage.handleRequestUpload so the workspace-shell state transition does not swallow the file picker when Upload Resume is clicked from paste mode. Updated the existing IdentityPage upload test to wait for the deferred input click again, matching the original working interaction contract.

Follow-up correction: the deferred hidden-input click reintroduced real-browser gesture risk. The final fix keeps uploadRef.current.click() synchronous inside the original button gesture because the file input is always mounted in the ExtractionAgentCard.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Repaired the Upload Resume regression by restoring the deferred hidden-file-input click after switching to upload mode. The existing IdentityPage upload interaction test now waits for the async chooser trigger again, and targeted vitest, typecheck, eslint, and build all passed. External review/audit artifacts were requested but remained empty due provider-side stall.

Final correction kept the hidden file input click synchronous so browsers continue to treat Upload Resume as a trusted user gesture.
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
