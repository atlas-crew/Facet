---
id: TASK-223
title: 'Validate audience taxonomy: is hiring_manager ever a non-recruiter audience?'
status: To Do
assignee: []
created_date: '2026-05-06 07:33'
labels:
  - audience-tagging
  - design
dependencies: []
references:
  - src/types/audience.ts
  - src/utils/audienceRules.ts
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

The current `AudienceTag` union has both `'recruiter'` and `'hiring_manager'` as separate audiences. Most rules in `audienceRules.ts` assign both together (`['recruiter', 'hiring_manager']`). If hiring_manager is *always* a superset of recruiter in practice, the split is over-engineering — a single `recruiter_only` flag would be enough to distinguish the rare HM-vs-recruiter case.

## What

Audit all uses of `'hiring_manager'` in the audience defaults and enrichment hooks. Determine whether there's any insight type where HM gets a different audience than recruiter. If not, simplify the taxonomy to either:
- Drop `'hiring_manager'` entirely and keep only `'recruiter'`
- Or keep the split but document the small set of differentiating cases

## Acceptance criteria

- Audit document listing every divergence point between recruiter and hiring_manager audiences
- Decision: collapse, keep, or split further (e.g., add `'panel'`)
- If collapsed: `AUDIENCE_RULES_VERSION` bumped, types updated, fixtures migrated
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
