---
id: TASK-245.6
title: Document golden fixture usage and maintenance
status: Done
assignee:
  - '@codex'
created_date: '2026-05-08 23:28'
updated_date: '2026-05-09 04:52'
labels:
  - documentation
milestone: m-29
dependencies:
  - TASK-245.2
documentation:
  - backlog/docs/doc-43 - Golden-E2E-Fixture-Coverage-Plan.md
modified_files:
  - docs/development/sample-data-and-fixtures.md
  - docs/NAVIGATOR.md
  - docs/user-guides/getting-started.md
parent_task_id: TASK-245
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update developer documentation so future agents know when to use route-local samples, persona fixtures, the golden workspace fixture, and hosted Playwright mocks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Sample-data docs explain the golden workspace fixture lane separately from in-app samples, dev-only source samples, and small unit fixtures.
- [x] #2 Docs include commands for validating the golden fixture and hosted mock path.
- [x] #3 Docs spell out the maintenance rule: update the golden fixture when cross-workspace contracts change, but keep unit fixtures minimal.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Updated the developer fixture map with a separate Golden workspace fixture lane, including the Maya builder, explicit Identity payload/hydration boundary, hosted mocks, dev-only demo loader, replacement semantics, and maintenance rule. Added validation commands for golden fixture Vitest coverage, dev loader/dialog coverage, hosted Playwright golden path, and typecheck. Updated NAVIGATOR description and cleaned production getting-started wording so user-visible Help does not advertise the dev-only demo action. Verification: npm run format:files on docs; git diff --check on docs; relevant code/test validations already passed in TASK-245.5 and are listed in the docs.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Golden fixture usage and maintenance are documented separately from in-app samples, dev source samples, and small unit fixtures.
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
