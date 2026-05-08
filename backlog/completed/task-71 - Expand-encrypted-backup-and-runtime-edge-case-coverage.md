---
id: TASK-71
title: Expand encrypted backup and runtime edge-case coverage
status: Done
assignee:
  - Codex
created_date: '2026-03-12 03:54'
updated_date: '2026-03-12 05:17'
labels:
  - remediation
  - persistence
  - testing
  - security
milestone: m-11
dependencies: []
references:
  - .agents/reviews/review-20260311-234341.md
  - .agents/reviews/test-audit-20260311-234545.md
  - .agents/reviews/test-audit-20260311-235122.md
  - .agents/reviews/review-20260312-002532.md
  - .agents/reviews/test-audit-20260312-002532.md
  - .agents/reviews/review-20260312-010951.md
  - .agents/reviews/test-audit-20260312-011505.md
  - >-
    backlog/tasks/task-72 -
    Stabilize-aggregate-Vitest-timeouts-for-ThemeEditorPanel-and-ResearchPage.md
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up from TASK-46 closeout. Capture the remaining non-blocking runtime and encrypted-backup edge cases called out by the latest code review and test audits without stretching the shipped backup feature slice further.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Persistence runtime tests cover remaining public API and failure-path gaps such as direct export, import failure recovery, and local-preferences backend failure handling.
- [x] #2 Encrypted backup tests cover the remaining envelope validation edge cases and filename/date edge conditions without weakening the crypto boundary.
- [x] #3 Any lifecycle or UX follow-up chosen from the review is either implemented or explicitly narrowed and documented.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Identify the still-missing backup dialog and runtime edge cases against TASK-71 acceptance criteria.
2. Add focused coverage for runtime export/import failure handling, local-preferences backend failures, encrypted backup envelope/filename edge cases, and remaining backup-dialog lifecycle paths.
3. Run targeted verification plus independent review/audit, capture any residual low-priority follow-up explicitly, and close TASK-71 if the remaining scope is satisfied.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-03-12: TASK-47 left a small set of non-blocking backup-dialog follow-ups in scope for this bucket, especially merge-mode/import-upload interaction coverage, mode reset/close behavior, and a few remaining accessibility/error-path checks from the latest audit.

2026-03-12: Starting TASK-71 follow-up hardening pass for the backup dialog and persistence runtime, focusing on the deferred edge-case coverage from TASK-46/TASK-47 rather than broad new product behavior.

2026-03-12: Completed the backup/runtime follow-up coverage pass. Added runtime tests for direct export without bootstrap, import recovery after local-preferences save failure, and bootstrap failure status when local-preferences loading fails; expanded backup-bundle coverage for malformed decrypted payloads and empty exportedAt filename handling; and substantially broadened WorkspaceBackupDialog coverage around merge mode, upload/import flows, cancel/error behavior, busy states, mode reset, readOnly/export guardrails, and reminder persistence semantics.

2026-03-12: Addressed final review findings by unifying the minimum backup passphrase length at 12 characters through the crypto boundary (`backupBundle.ts`) and removing `markBackupCreated()` from import flows so restore/merge actions do not suppress future backup reminders.

2026-03-12 verification: `npm run typecheck`; `npx vitest run src/test/WorkspaceBackupDialog.test.tsx src/test/persistenceRuntime.test.ts src/test/workspaceBackup.test.ts`; `npx eslint src/components/WorkspaceBackupDialog.tsx src/persistence/backupBundle.ts src/test/WorkspaceBackupDialog.test.tsx src/test/persistenceRuntime.test.ts src/test/workspaceBackup.test.ts`; `npm run build` all passed.

2026-03-12 review/audit: `review-20260312-010951.md` returned PASS WITH ISSUES with only P2/P3 maintainability notes left; `test-audit-20260312-011505.md` returned no remaining P0/P1 gaps and only P2 polish follow-ups.

2026-03-12: `npm run test` still hit aggregate-only timeouts in `src/test/ThemeEditorPanel.test.tsx` and `src/test/ResearchPage.test.tsx`, but both files passed when rerun directly. Captured that unrelated suite-level stability work in TASK-72 instead of folding it into this persistence task.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Expanded the encrypted backup and persistence-runtime hardening pass across dialog UX, runtime failure handling, and crypto boundary consistency. The shipped slice now covers the deferred TASK-46/TASK-47 edge cases, keeps backup reminder semantics honest by only marking actual exports as backups, and aligns the UI and crypto layer on a shared 12-character minimum passphrase. Targeted typecheck, lint, focused Vitest coverage, build, and final independent review/audit all passed; the only remaining verification drift was an unrelated aggregate-suite timeout pair captured separately in TASK-72.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [ ] #2 Documentation has been created/modified/removed as needed.
- [ ] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [x] #4 Test changes were approved by a test gap analysis review
- [x] #5 Changes to integration points are covered by tests
- [ ] #6 All tests pass successfully
- [ ] #7 Automatic formatting was applied.
- [x] #8 Linters report no WARNINGS or ERRORS
- [x] #9 The project builds successfully
<!-- DOD:END -->
