---
id: TASK-245.4
title: Add deterministic cross-workspace golden E2E test
status: Done
assignee:
  - '@codex'
created_date: '2026-05-08 23:27'
updated_date: '2026-05-09 04:43'
labels:
  - feature
milestone: m-29
dependencies:
  - TASK-245.2
documentation:
  - backlog/docs/doc-43 - Golden-E2E-Fixture-Coverage-Plan.md
modified_files:
  - src/test/fixtures/goldenWorkspace.test.ts
  - src/test/fixtures/personas/mayaPatel.ts
parent_task_id: TASK-245
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a deterministic integration test that uses the golden fixture to prove Identity, Research, Pipeline, JDAnalysis, Build, Letters, Prep, and Debrief references stay connected without live AI.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The test loads the golden fixture through store hydration or snapshot hydration rather than duplicating object literals inline.
- [x] #2 The test asserts key cross-workspace links: pipeline JDAnalysis, pipeline resume/letter/prep links, research promotion context, and debrief/prep round linkage.
- [x] #3 The test uses contract-style assertions that catch broken relationships while avoiding brittle full-text snapshots.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a contract-style golden workspace test that loads buildMayaPatelGoldenWorkspace() and indexes identity, resume, pipeline, JDAnalysis, letters, prep, debrief, and research artifacts.\n2. Assert the key cross-workspace links without duplicating fixture object literals or using full-text snapshots.\n3. Run focused tests/lint/format, independent review, update Backlog, and commit with cortex git commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added a contract-style golden workspace graph test that loads buildMayaPatelGoldenWorkspace() and verifies cross-workspace links across Pipeline, JDAnalysis, resume/build, letters, prep round/deck/cards, research run/result plus Pipeline research promotion snapshot, and debrief identity references. Added a seeded Pipeline research snapshot to Maya's Pillar entry so promotion context is covered. Verification: npx vitest run src/test/fixtures/goldenWorkspace.test.ts src/test/fixtures/personas/validate.test.ts src/test/fixtures/personas/validate.negative.test.ts passed (3 files, 27 tests); npx eslint focused files passed; npm run format:files applied; independent review CLEAN after remediation.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added deterministic golden cross-workspace contract coverage without duplicating fixture literals or brittle full-text snapshots. The test now catches broken links across research, pipeline, JD analysis, resume, cover letters, prep, and debrief identity references.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 Automatic formatting was applied to touched files
- [x] #4 Regression tests pass (scoped to touched files)
- [x] #5 Linters report no warnings or errors in touched files
- [x] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
