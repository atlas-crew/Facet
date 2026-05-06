---
id: TASK-225
title: Document AUDIENCE_RULES_VERSION migration policy
status: To Do
assignee: []
created_date: '2026-05-06 07:33'
labels:
  - audience-tagging
  - documentation
dependencies: []
references:
  - src/utils/audienceRules.ts
  - src/store/jdAnalysisStore.ts
  - docs/architecture/
  - docs/NAVIGATOR.md
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

The audience-tagging rules engine has an explicit version-mismatch policy already implemented in `applyRulesBasedAudiences` and `sanitizeAnalysis`: when `audienceRulesVersion` doesn't match the current `AUDIENCE_RULES_VERSION` constant, the engine re-applies all rules but preserves any `asserted` tags. The policy is correct and tested — but it's only legible from reading the code, not from any architecture document.

## What

Add a section to `docs/architecture/` (likely a new `audience-tagging.md` or extension to an existing identity/JD doc) documenting:
- The two-layer tag model (`inferred` / `asserted`)
- The `AUDIENCE_RULES_VERSION` lifecycle: bump → re-apply on hydration → preserve `asserted`
- The `'unclassified'` floor sentinel and why it's fail-closed
- The discipline note about `null` vs `[]` for `asserted` (load-bearing for Phase 5 eval queries)
- Index in `docs/NAVIGATOR.md`

## Acceptance criteria

- Architecture doc exists and explains the migration policy
- NAVIGATOR.md references it
- Doc cross-links to `src/utils/audienceRules.ts` and `src/types/audience.ts`
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
