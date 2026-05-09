---
id: TASK-245.4
title: Add deterministic cross-workspace golden E2E test
status: In Progress
assignee:
  - '@codex'
created_date: '2026-05-08 23:27'
updated_date: '2026-05-09 04:39'
labels:
  - feature
milestone: m-29
dependencies:
  - TASK-245.2
documentation:
  - backlog/docs/doc-43 - Golden-E2E-Fixture-Coverage-Plan.md
parent_task_id: TASK-245
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a deterministic integration test that uses the golden fixture to prove Identity, Research, Pipeline, JDAnalysis, Build, Letters, Prep, and Debrief references stay connected without live AI.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The test loads the golden fixture through store hydration or snapshot hydration rather than duplicating object literals inline.
- [ ] #2 The test asserts key cross-workspace links: pipeline JDAnalysis, pipeline resume/letter/prep links, research promotion context, and debrief/prep round linkage.
- [ ] #3 The test uses contract-style assertions that catch broken relationships while avoiding brittle full-text snapshots.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a contract-style golden workspace test that loads buildMayaPatelGoldenWorkspace() and indexes identity, resume, pipeline, JDAnalysis, letters, prep, debrief, and research artifacts.\n2. Assert the key cross-workspace links without duplicating fixture object literals or using full-text snapshots.\n3. Run focused tests/lint/format, independent review, update Backlog, and commit with cortex git commit.
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
