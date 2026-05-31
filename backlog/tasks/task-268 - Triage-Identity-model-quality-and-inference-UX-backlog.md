---
id: TASK-268
title: Triage Identity model quality and inference UX backlog
status: To Do
assignee: []
created_date: '2026-05-31 20:48'
labels:
  - feature
  - identity
  - triage
dependencies: []
references:
  - TODO.md
priority: medium
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Parent task for the Identity TODO triage captured in TODO.md on 2026-05-31. The child tasks split user-facing issues into reviewable slices: import route naming, long-running inference progress, all-inference orchestration, skill model expansion, expertise modeling, fill-strength help, project deepening, next-attention navigation, and Identity Map inspector rendering.

Placement: candidate-only model quality and inference orchestration belong in Identity. Per facet-feature-placement, downstream artifacts should mirror identity rather than re-derive candidate facts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each child issue from the Identity section of TODO.md is represented as a backlog task or intentionally deduplicated with an existing task.
- [ ] #2 Child tasks preserve the architecture split: candidate-only data in Identity, artifacts as derived projections, scan-only actions kept in import when appropriate.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Use this parent as the coordination handle for the Identity TODO triage cluster.
2. Work child tasks independently where possible; avoid bundling schema/model expansion with UI-only fixes.
3. For model-shape changes, load facet-architecture-guard and facet-persistence-changes before implementation.
4. Keep import-only bulk-deepen controls separate from canonical Map-wide inference unless a child task explicitly scopes a bridge.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Regression tests pass (scoped to touched files)
- [ ] #5 Linters report no warnings or errors in touched files
- [ ] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
