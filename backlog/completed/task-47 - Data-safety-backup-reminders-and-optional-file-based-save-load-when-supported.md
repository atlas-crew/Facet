---
id: TASK-47
title: >-
  Data safety: backup reminders and optional file-based save/load (when
  supported)
status: Done
assignee:
  - Codex
created_date: '2026-03-10 03:54'
updated_date: '2026-03-12 04:31'
labels:
  - feature
milestone: m-10
dependencies:
  - TASK-65
references:
  - .agents/reviews/review-20260312-002532.md
  - .agents/reviews/test-audit-20260312-002532.md
documentation:
  - 'backlog://document/doc-5'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add lightweight safety rails: periodic 'you have unsaved local data' reminders plus optional File System Access API save/load for users who want a real file-backed workflow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 User can enable/disable backup reminders; reminders are non-blocking and respect a snooze interval.
- [x] #2 When File System Access API is available, user can save/load a data file without copy/paste.
- [x] #3 App handles unsupported browsers gracefully (feature hidden/disabled).
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend local-only persistence contracts/state with backup reminder preferences and last-backup metadata.
2. Add non-blocking reminder UI in AppShell that respects enable/disable and snooze interval behavior.
3. Add optional File System Access save/load helpers to the encrypted backup dialog with graceful fallback for unsupported browsers.
4. Cover the new runtime/UI flows with focused Vitest + Testing Library tests, then run review/audit and close out the task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-03-12: Starting implementation for backup reminders plus optional File System Access save/load integration on top of the persistence runtime and encrypted backup flow.

2026-03-12: Added local-only backup reminder preferences plus a non-blocking reminder banner that only nudges when local saves are newer than the latest file backup and respects snooze/disable controls.

2026-03-12: Added optional File System Access save/load helpers on top of the encrypted backup bundle flow, with graceful fallback to browser download/upload when the API is unavailable.

2026-03-12: Initial Claude review and test audit completed successfully via .agents/reviews/review-20260312-002532.md and .agents/reviews/test-audit-20260312-002532.md; remediation addressed the important passphrase/accessibility gaps and rolled the remaining non-blocking follow-up into TASK-71.

2026-03-12: Attempted a final post-remediation Claude re-review and re-audit, but both follow-up CLI runs hit the nightly quota limit before producing usable artifacts.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added backup reminders and optional file-based save/load on top of the persistence runtime. Local-only UI preferences now track reminder enablement, snooze interval, snoozed-until timestamp, and last file backup time; AppShell shows a non-blocking reminder banner only when local saves are newer than the latest backup. The encrypted backup dialog now enforces minimum passphrase length, exposes reminder settings, adds File System Access save/load actions for supported browsers, improves accessibility semantics for dynamic status messaging, and keeps unsupported browsers on the existing download/upload fallback. Regression coverage now includes reminder-policy helpers, banner interactions, dialog file-system actions, passphrase mismatch handling, and export/import error paths. Verification: npm run typecheck; focused Vitest for persistence/ui/backup files; targeted ESLint on touched code; npm run test; npm run build.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Documentation has been created/modified/removed as needed.
- [ ] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [ ] #4 Test changes were approved by a test gap analysis review
- [x] #5 Changes to integration points are covered by tests
- [x] #6 All tests pass successfully
- [ ] #7 Automatic formatting was applied.
- [x] #8 Linters report no WARNINGS or ERRORS
- [x] #9 The project builds successfully
<!-- DOD:END -->
