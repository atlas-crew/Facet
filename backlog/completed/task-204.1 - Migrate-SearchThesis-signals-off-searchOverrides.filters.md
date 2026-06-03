---
id: TASK-204.1
title: Migrate SearchThesis signals off searchOverrides.filters
status: Done
assignee:
  - '@codex'
created_date: '2026-05-06 22:46'
updated_date: '2026-05-08 07:49'
labels:
  - refactor
  - search-redesign
  - lane-b
dependencies:
  - TASK-204
references:
  - src/types/search.ts
  - src/store/searchStore.ts
  - src/test/searchStore.test.ts
documentation:
  - backlog doc-39
  - backlog doc-34
  - backlog TASK-204
parent_task_id: TASK-204
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement doc-39's schema and persisted-state migration for canonical search-stage signals. Enrich SearchThesis.lookFor / SearchThesis.avoid into stable signal entries, lift legacy searchOverrides.filters.prioritize into lookFor, lift legacy searchOverrides.filters.avoid into avoid, and remove searchOverrides.filters as canonical thesis storage. Keep searchOverrides.constraints, searchOverrides.interviewPrefs, and hiddenSkillIds intact. This should land before TASK-196.3 so TASK-196 does not add ids/toggles to fields that disappear.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 SearchThesis lookFor and avoid use one canonical enriched signal shape with stable ids and qualifier support
- [x] #2 Persisted theses with legacy lookFor string arrays, avoid objects, and searchOverrides.filters arrays migrate non-destructively and idempotently
- [x] #3 Duplicate entries across canonical and legacy surfaces are deduped case-insensitively without losing avoid.condition
- [x] #4 searchOverrides.filters is no longer produced or required after migration while constraints/interviewPrefs/hiddenSkillIds remain intact
- [x] #5 Regression tests cover union/dedupe, condition preservation, idempotency, and already-migrated no-op behavior
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented canonical SearchThesisSignal lookFor/avoid storage and migration. Legacy lookFor strings, avoid entries, and searchOverrides.filters are folded into canonical signals with ssig ids, condition preservation, case-insensitive dedupe, and idempotent rehydration. Workspace snapshot hydration now runs the same research migration path. Added shared thesis signal reconciliation helper for route/editor label edits.

Validation: npm run typecheck; npx vitest run src/test/searchStore.test.ts src/test/thesisGenerator.test.ts src/test/thesisSignals.test.ts src/test/ResearchPage.test.tsx src/test/searchRedesignRoundTrip.test.tsx src/test/persistence.test.ts src/test/workspaceBackup.test.ts src/test/SearchInstancePreferences.editInIdentity.test.tsx (8 files, 179 tests); npx eslint on all touched source/test files.

Independent review/audit receipts: core source review .agents/reviews/review-20260506-220341.md (P0/P1=0); route/source review .agents/reviews/review-20260506-221718.md (P0/P1=0); generator audit .agents/reviews/test-audit-20260506-220341.md (P0/P1=0); route/signals audit .agents/reviews/test-audit-20260506-222754.md (P0/P1/P2=0).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Canonicalized SearchThesis lookFor/avoid as enriched signal entries, removed searchOverrides.filters from canonical writes, and added defensive migrations for legacy local and workspace-snapshot research payloads. Route editors now reconcile signal labels through a shared helper that preserves ids/metadata, dedupes input, and creates canonical ssig signals for new labels. Focused regression coverage now covers store migration, generator normalization, route editing, component editing, workspace hydration, and thesis signal reconciliation.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 Automatic formatting was applied to touched files
- [x] #4 Linters report no WARNINGS or ERRORS for touched files
- [x] #5 Regression tests pass for touched files
<!-- DOD:END -->
