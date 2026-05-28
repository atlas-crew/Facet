---
id: TASK-50
title: 'Design health: expand ATS/design lint checks and surface actionable fixes'
status: Done
assignee:
  - '@codex'
created_date: '2026-03-10 03:54'
updated_date: '2026-05-28 06:24'
labels:
  - feature
  - quality
milestone: m-1
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`src/utils/designHealth.ts` currently checks only sizes/margins/lineHeight. Expand to catch common ATS/readability hazards (contrast, tiny links, overlong bullets, missing contact fields) and present actionable feedback.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Design health report includes additional checks (at least contrast, link styling/format, missing contact fields, and overlong bullets).
- [x] #2 UI surfaces the issues with direct pointers to the relevant theme/token/field.
- [x] #3 Unit tests cover new checks deterministically.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Codex starting TASK-50. Plan: inspect current designHealth checks and UI consumer, add deterministic ATS/readability checks for contrast, link styling/format, missing contact fields, and overlong bullets; surface direct pointers in the existing report UI; add focused utility/UI tests; run lint/typecheck/tests/review; commit via cortex.

Implemented expanded design health checks for contrast, project link sizing, header link formats, missing contact info, overlong bullets, malformed colors, and partial-data safety. ThemeEditorPanel now receives resume data from BuildPage, gates health calculation while hidden, and renders actionable design/content pointers. Verification: npx vitest run src/test/designHealth.test.ts src/test/ThemeEditorPanel.test.tsx src/test/BuildPage.test.tsx (35 passing before final sizeSmall boundary, then 36 passing); npx eslint touched files; npx tsc --noEmit --pretty false; npm run lint; npm run build. Independent review: specialist-review PASS WITH ISSUES with no P1 blockers; targeted test audits for ThemeEditorPanel and designHealth completed, with P1 gaps addressed by added tests.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Expanded design health from theme-only checks into actionable ATS/readability checks across theme colors, link sizing/formatting, contact completeness, bullet length, malformed colors, and partial persisted data. Wired BuildPage resume data into ThemeEditorPanel, rendered user-facing issue pointers, and added focused utility/UI/integration coverage.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Documentation has been created/modified/removed as needed.
- [x] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [x] #4 Test changes were approved by a test gap analysis review
- [x] #5 Changes to integration points are covered by tests
- [x] #6 All tests pass successfully
- [x] #7 Automatic formatting was applied.
- [x] #8 Linters report no WARNINGS or ERRORS
- [x] #9 The project builds successfully
<!-- DOD:END -->
