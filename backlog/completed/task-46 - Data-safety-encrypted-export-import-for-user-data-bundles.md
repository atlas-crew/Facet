---
id: TASK-46
title: 'Data safety: encrypted export/import for user data bundles'
status: Done
assignee:
  - '@codex'
created_date: '2026-03-10 03:54'
updated_date: '2026-03-12 03:54'
labels:
  - feature
  - security
milestone: m-10
dependencies:
  - TASK-65
  - TASK-66
documentation:
  - 'backlog://document/doc-5'
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Local-only `localStorage` is fragile. Add an encrypted export format (passphrase-based) and matching import flow so users can back up their resume/pipeline/prep/letters data safely.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Export produces a single encrypted file (or text blob) using WebCrypto (AES-GCM) with a user-provided passphrase.
- [x] #2 Import supports decrypting the bundle and merging/replacing data using existing validation rules.
- [x] #3 No plaintext secrets/passphrases are persisted to localStorage.
- [x] #4 Failure states are clear (wrong passphrase, corrupt file) without data loss.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verification: npm run typecheck

Verification: npx vitest run src/test/persistence.test.ts src/test/persistenceRuntime.test.ts src/test/workspaceBackup.test.ts src/test/WorkspaceBackupDialog.test.tsx src/test/remotePersistenceBackend.test.ts src/test/facetServer.test.ts src/test/pipelineStore.test.ts src/test/prepStore.test.ts src/test/coverLetterStore.test.ts src/test/searchStore.test.ts src/test/resumeStore.test.ts src/test/PrepPage.test.tsx src/test/ResearchPage.test.tsx src/test/LettersPage.test.tsx

Verification: npx eslint src/components/AppShell.tsx src/components/WorkspaceBackupDialog.tsx src/persistence src/test/workspaceBackup.test.ts src/test/WorkspaceBackupDialog.test.tsx src/test/persistenceRuntime.test.ts src/test/persistence.test.ts src/test/remotePersistenceBackend.test.ts src/test/facetServer.test.ts src/test/fixtures/workspaceSnapshot.ts src/types/proxy-modules.d.ts proxy/server.js proxy/facetServer.js proxy/persistenceApi.js

Verification: npm run build

Claude review: .agents/reviews/review-20260311-234341.md

Runtime audit: .agents/reviews/test-audit-20260311-234545.md

Backup audit: .agents/reviews/test-audit-20260311-235122.md

Residual non-blocking runtime and encrypted-backup follow-up captured in TASK-71.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added passphrase-based encrypted workspace backup and restore on top of the shared persistence runtime. The app can now export a single AES-GCM encrypted backup file/text blob from the live workspace snapshot, import it in replace or merge mode through the runtime and coordinator, scope imported data safely to the active workspace, and surface the workflow through a global Backup dialog in AppShell. Added regression coverage for crypto round-trips, passphrase validation, corrupted/tampered bundle handling, workspace merge helpers, dialog flows, import-vs-autosave races, and dispose-during-start/runtime teardown edges.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Documentation has been created/modified/removed as needed.
- [ ] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [x] #4 Test changes were approved by a test gap analysis review
- [x] #5 Changes to integration points are covered by tests
- [x] #6 All tests pass successfully
- [ ] #7 Automatic formatting was applied.
- [x] #8 Linters report no WARNINGS or ERRORS
- [x] #9 The project builds successfully
<!-- DOD:END -->
