---
id: TASK-100
title: Harden IdentityPage failure-path and bulk-flow tests
status: Done
assignee:
  - '@codex'
created_date: '2026-04-10 18:38'
updated_date: '2026-05-08 21:01'
labels:
  - tests
  - identity
dependencies: []
references:
  - .agents/reviews/test-audit-20260410-143527.md
  - src/test/IdentityPage.test.tsx
  - src/routes/identity/IdentityPage.tsx
  - .agents/reviews/test-audit-20260410-184644.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Close the independent test-audit gaps around IdentityPage error handling, multi-bullet bulk deepening, upload validation, and navigation/export guard behaviors so the page has explicit regression coverage for its external-boundary and batch-operation paths.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 IdentityPage has explicit tests for non-abort scan, draft-generation, and single-bullet deepen failures.
- [x] #2 IdentityPage has multi-bullet bulk-deepen coverage for success and partial-failure accounting.
- [x] #3 IdentityPage has regression coverage for invalid uploads, clear-scan reset, enrichment CTA navigation, and export availability guards.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-04-10 quick audit during TASK-101 confirmed the upload-picker regression test is covered and reiterated broader non-blocking gaps for scan errors, draft-generation errors, bullet-deepen errors, paste-only generation, and invalid file-type drops.

2026-05-08 closeout added the remaining high-signal IdentityPage regressions in `src/test/IdentityPage.test.tsx`: non-PDF upload rejection before scanner invocation, non-abort scan failure, draft-generation failure, single-bullet deepen failure state, partial bulk-deepen failure accounting, export guards before draft/current model availability, and the primary enrichment CTA navigation target. Existing coverage already exercised clear-scan reset and bulk-cancel cleanup.

Verification:

- `npx vitest run src/test/IdentityPage.test.tsx` — 33 passed.
- `npx eslint src/test/IdentityPage.test.tsx` — passed.
- `npm run format:files:check -- src/test/IdentityPage.test.tsx "backlog/tasks/task-100 - Harden-IdentityPage-failure-path-and-bulk-flow-tests.md"` — passed after repairing `src/test/IdentityPage.test.tsx` with `npm run format:files`.

Full-suite/build gates were not rerun for this narrow test-only slice while parallel doc-40 workers had active dirty work; the targeted file gate is clean.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
