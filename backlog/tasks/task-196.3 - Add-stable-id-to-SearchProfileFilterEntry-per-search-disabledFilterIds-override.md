---
id: TASK-196.3
title: Retarget per-search signal disablement to canonical SearchThesisSignal ids
status: Done
assignee:
  - '@codex'
created_date: '2026-04-29 08:41'
updated_date: '2026-05-08 08:37'
labels:
  - search-redesign
  - identity-model
dependencies:
  - TASK-204.1
references:
  - src/types/search.ts
  - src/store/searchStore.ts
  - src/utils/identitySearchProfile.ts
  - src/test/searchStore.test.ts
documentation:
  - backlog doc-39
  - backlog doc-34 (Search Parameters Surface — Design)
  - backlog doc-24 (Search Workspace Redesign)
parent_task_id: TASK-196
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reconciled by TASK-204.4 after doc-39 and TASK-204.1.

Do not add stable ids to SearchProfileFilterEntry and do not add disabledFilterIds to searchOverrides.filters.*. TASK-204.1 made SearchThesis.lookFor and SearchThesis.avoid the canonical search-stage signal lists, and those SearchThesisSignal entries already carry stable ids.

If per-search signal disablement remains desired, implement it against canonical SearchThesisSignal ids from SearchThesis.lookFor/SearchThesis.avoid, using storage that clearly references thesis signal ids rather than legacy profile filter strings. Legacy searchOverrides.filters.prioritize/avoid are deleted migration input and must not be revived.

TASK-196 hard-constraints work remains unaffected: industries, funding, remote, employment, salary, clearance, and company-size constraints still live under TASK-196.4 / the surviving hard-constraints scope.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 No code path adds ids to SearchProfileFilterEntry solely for deleted prioritize/avoid filter arrays
- [x] #2 Any per-search disable storage references canonical SearchThesisSignal ids from SearchThesis.lookFor/SearchThesis.avoid, not searchOverrides.filters.*
- [x] #3 Migration/default initialization is idempotent and tolerates existing thesis signal ids without regenerating them
- [x] #4 Per-search disablement, if implemented, does not mutate canonical thesis signals; clearing the disable restores the signal for that search context
- [x] #5 Tests cover canonical signal-id disablement or explicitly document that per-search signal toggles are de-scoped
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Verify current SearchThesis/search preference shapes and confirm legacy filter arrays are not part of the active UI.
2. Choose the narrowest reconciled scope: either canonical thesis-signal disabled ids, or explicit de-scope if current product surface already routes edits to Search Thesis.
3. Add focused store/UI regression coverage for the chosen scope.
4. Run focused tests, typecheck/build as needed, update backlog AC/DoD, and commit atomically with cortex git commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Closed by explicit de-scope decision after TASK-204 cleanup: per-search signal disablement is not implemented, no legacy searchOverrides.filters.* arrays or SearchProfileFilterEntry ids are revived, and canonical SearchThesisSignal ids remain stable/migration-tolerant. Focused regression coverage verifies legacy filters are migration-only and already-migrated canonical thesis signals retain ids. Verification: focused searchStore tests passed 3/3; ResearchPage no-legacy-toggle test passed; scoped ESLint passed; npm run typecheck passed; npm run build passed with existing chunk-size warnings.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
De-scoped per-search signal disablement in favor of canonical thesis signal editing. Added regression coverage ensuring legacy filter arrays remain migration-only and canonical SearchThesisSignal ids are preserved. No runtime toggle storage was added.
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
