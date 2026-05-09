---
id: TASK-245.2
title: Build golden workspace snapshot composer
status: Done
assignee:
  - '@codex'
created_date: '2026-05-08 23:27'
updated_date: '2026-05-09 04:27'
labels:
  - feature
milestone: m-29
dependencies:
  - TASK-245.1
documentation:
  - backlog/docs/doc-43 - Golden-E2E-Fixture-Coverage-Plan.md
modified_files:
  - src/test/fixtures/goldenWorkspace.ts
  - src/test/fixtures/goldenWorkspace.test.ts
  - src/test/fixtures/personas/mayaPatel.ts
parent_task_id: TASK-245
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a reusable builder that composes the Maya golden artifacts into a workspace/snapshot-shaped fixture for Vitest and hosted Playwright tests. Keep Identity hydration explicit if Identity remains outside FacetWorkspaceSnapshot.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A builder such as buildMayaPatelGoldenWorkspace() or buildGoldenWorkspaceSnapshot() returns a complete reusable fixture without mutating shared singleton data.
- [x] #2 The builder includes all persisted workspace artifacts plus an explicit Identity hydration payload or helper.
- [x] #3 A focused round-trip test proves the golden workspace validates, hydrates, and re-exports without dropping required artifacts.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a golden workspace fixture composer that wraps Maya's persona artifacts into FacetWorkspaceSnapshot payloads plus explicit identity hydration payloads.\n2. Add focused tests for clone isolation, snapshot validation, store hydration, explicit Identity hydration, and re-export artifact retention.\n3. Format, run focused tests/lint/typecheck receipts, independent review, update Backlog, and commit with cortex git commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented buildMayaPatelGoldenWorkspace() with a complete FacetWorkspaceSnapshot, explicit identity storage envelope/helper, and store hydration helper. Added goldenWorkspace tests for snapshot validation, clone isolation, workspace+identity hydration, and re-export retention across all durable artifacts including normalized cover-letter hashes. Verification: npx vitest run src/test/fixtures/goldenWorkspace.test.ts src/test/fixtures/personas/validate.test.ts src/test/fixtures/personas/validate.negative.test.ts passed (3 files, 26 tests); npx eslint touched files passed; npm run format:files applied. Full npm run typecheck remains blocked by existing src/test/identityFieldDeps.test.ts SkillMatch export error.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the reusable Maya golden workspace composer and focused validation/round-trip tests. Identity remains explicit outside FacetWorkspaceSnapshot via a storage envelope and hydration helper. Independent review is clean after hash-drift remediation.
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
