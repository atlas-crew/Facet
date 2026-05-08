---
id: TASK-245.1
title: Add Maya golden fixture data artifacts
status: In Progress
assignee:
  - '@codex'
created_date: '2026-05-08 23:27'
updated_date: '2026-05-08 23:50'
labels:
  - feature
milestone: m-29
dependencies: []
documentation:
  - backlog/docs/doc-43 - Golden-E2E-Fixture-Coverage-Plan.md
modified_files:
  - src/test/fixtures/personas/mayaPatel.ts
parent_task_id: TASK-245
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend the Maya Patel fixture set with production-shaped artifacts needed for a golden E2E workspace: canonical JDAnalysis, cover letter draft/snapshot, recruiter card, LinkedIn draft, debrief session, and research thesis/request/run data tied to the Pillar Systems pipeline entry.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Maya fixture exports production-shaped JDAnalysis linked to the Pillar pipeline entry by pipelineEntryId and jdAnalysisId.
- [ ] #2 Maya fixture includes linked cover letter, recruiter, LinkedIn, debrief, and research artifacts without inventing candidate-only facts outside Identity.
- [ ] #3 Existing persona fixture validation is expanded or supplemented to catch dangling IDs across the new artifact types.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend Maya persona types/exports with downstream artifact arrays for JDAnalysis, cover letters, LinkedIn drafts, recruiter cards, debrief sessions, and research workspace data.\n2. Add fictional, identity-grounded Maya/Pillar artifacts and wire IDs back to the existing Pillar pipeline entry.\n3. Expand persona validation to catch dangling references across the new artifact types.\n4. Run focused persona fixture validation, typecheck/lint on touched files, independent review/audit, then commit the slice atomically.
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
