---
id: TASK-68
title: >-
  Build sync-aware client repository and migrate stores behind the persistence
  coordinator
status: Done
assignee:
  - '@codex'
created_date: '2026-03-11 17:40'
updated_date: '2026-03-12 01:07'
labels:
  - feature
  - frontend
  - persistence
milestone: m-11
dependencies:
  - TASK-65
  - TASK-66
  - TASK-67
references:
  - src/store/resumeStore.ts
  - src/store/pipelineStore.ts
  - src/store/prepStore.ts
  - src/store/coverLetterStore.ts
  - src/store/searchStore.ts
  - src/store/uiStore.ts
documentation:
  - 'backlog://document/doc-5'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace direct durable writes from individual Zustand stores with a shared persistence path that can hydrate from local cache, save through the coordinator, and surface sync status in the UI. This is the bridge between today's local-only store persistence and tomorrow's multi-tenant backend authority.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Durable stores hydrate and save through a shared persistence coordinator or repository instead of each store writing independently to browser storage.
- [x] #2 The client can distinguish durable sync state from ephemeral UI state and expose basic status such as saved, saving, offline, or error.
- [x] #3 A local cache backend suitable for larger durable payloads is selected and integrated without breaking current startup or migration behavior.
- [x] #4 Existing features keep working through the migration, with a documented path for reading previous localStorage data into the new persistence flow.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verification: npm run typecheck

Verification: npx vitest run src/test/persistence.test.ts src/test/persistenceRuntime.test.ts src/test/remotePersistenceBackend.test.ts src/test/facetServer.test.ts src/test/pipelineStore.test.ts src/test/prepStore.test.ts src/test/coverLetterStore.test.ts src/test/searchStore.test.ts src/test/resumeStore.test.ts src/test/PrepPage.test.tsx src/test/ResearchPage.test.tsx src/test/LettersPage.test.tsx

Verification: npx eslint src/components/AppShell.tsx src/persistence src/store/resumeStore.ts src/store/pipelineStore.ts src/store/prepStore.ts src/store/coverLetterStore.ts src/store/searchStore.ts src/test/persistence.test.ts src/test/persistenceRuntime.test.ts src/test/remotePersistenceBackend.test.ts src/test/facetServer.test.ts src/test/fixtures/workspaceSnapshot.ts src/types/proxy-modules.d.ts proxy/server.js proxy/facetServer.js proxy/persistenceApi.js

Verification: npm run build

Claude review: .agents/reviews/review-20260311-210237.md

Test audit: .agents/reviews/test-audit-20260311-210447.md

Residual non-blocking hardening and follow-up coverage moved to TASK-70.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced per-store durable persistence with a shared runtime that hydrates through the coordinator, writes workspace snapshots through the common backend flow, keeps local-only preferences separate, falls back through the documented legacy localStorage migration path, and surfaces sync status in AppShell. Added runtime and hydration regression coverage for bootstrap, legacy migration, flush-before-start, in-flight flush coordination, debounced autosave, autosave failure handling, singleton disposal, direct hydration helpers, and no-legacy cold starts.
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
