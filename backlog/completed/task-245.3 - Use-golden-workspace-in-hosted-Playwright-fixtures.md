---
id: TASK-245.3
title: Use golden workspace in hosted Playwright fixtures
status: Done
assignee:
  - '@codex'
created_date: '2026-05-08 23:27'
updated_date: '2026-05-09 04:38'
labels:
  - feature
milestone: m-29
dependencies:
  - TASK-245.2
documentation:
  - backlog/docs/doc-43 - Golden-E2E-Fixture-Coverage-Plan.md
modified_files:
  - tests/hosted/fixtures.ts
  - tests/hosted/golden-workspace.spec.ts
  - src/test/fixtures/goldenWorkspace.ts
  - src/test/fixtures/goldenWorkspace.test.ts
  - src/test/fixtures/personas/mayaPatel.ts
parent_task_id: TASK-245
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teach hosted API mocks to serve the golden workspace fixture when tests need realistic cross-workspace data, while preserving the minimal empty snapshot path for persistence edge cases.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Hosted mock helpers can opt into the golden workspace snapshot without changing existing minimal-snapshot tests.
- [x] #2 At least one hosted Playwright test hydrates the golden workspace and verifies representative data renders after account/workspace bootstrap.
- [x] #3 The fixture remains deterministic and does not require live AI, network calls, or real personal data.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add an opt-in workspaceSnapshot provider to hosted API mocks while preserving the default minimal snapshot.\n2. Add a deterministic hosted Playwright test that serves the Maya golden workspace, seeds Identity localStorage explicitly, and asserts representative Pillar research data renders after bootstrap.\n3. Run focused hosted test/lint/format receipts, independent review, update Backlog, and commit with cortex git commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added hosted API mock opt-in for a supplied workspace snapshot while preserving the minimal default. Added a hosted golden workspace spec that seeds Maya identity localStorage explicitly, serves the Maya golden snapshot, navigates to Research, and asserts Pillar Systems data renders from hosted persistence. Made the golden fixture import path Node-pure by avoiding top-level app store/hydration imports and localizing the fixture JD hash helper. Verification: npx vitest run src/test/fixtures/goldenWorkspace.test.ts src/test/fixtures/personas/validate.test.ts src/test/fixtures/personas/validate.negative.test.ts passed (3 files, 26 tests); npx eslint focused files passed; npm run typecheck -- --pretty false passed; VITE_FACET_DEPLOYMENT_MODE=hosted npx playwright test tests/hosted/golden-workspace.spec.ts --project=hosted passed (2 tests including auth setup); independent review CLEAN.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Hosted Playwright fixtures can now opt into the Maya golden workspace without changing the minimal default, and a deterministic hosted spec proves Maya/Pillar research data hydrates and renders without live AI. Fixture import purity was tightened so Playwright can load the golden builder in Node.
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
