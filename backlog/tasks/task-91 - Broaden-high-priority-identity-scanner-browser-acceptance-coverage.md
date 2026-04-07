---
id: TASK-91
title: Broaden high priority identity scanner browser acceptance coverage
status: To Do
assignee: []
created_date: '2026-04-07 02:07'
labels:
  - scanner
  - testing
  - playwright
dependencies: []
references:
  - /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-020456.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deferred from test audit artifact /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-020456.md.

Remaining high-priority browser acceptance gaps:
- P1-001: re-uploading a different PDF without clearing first
- P1-002: resume with missing optional sections
- P1-003: multiple roles parsed and rendered correctly
- P1-004: multiple bullet points per role preserve order
- P1-005: initial page state before upload
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The browser acceptance suite covers uploading a second PDF without clearing and verifies the first scan is fully replaced.
- [ ] #2 The suite covers a resume with no projects or education and asserts the scanner renders only the available sections.
- [ ] #3 The suite covers multiple roles and verifies role metadata is rendered for each role.
- [ ] #4 The suite covers multiple bullets in one role and verifies bullet ordering.
- [ ] #5 The suite verifies the initial /identity page state before any upload.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend the in-memory PDF fixtures to represent the missing resume shapes.
2. Add one focused Playwright spec per uncovered high-priority behavior.
3. Re-run the browser suite and a fresh test audit for the expanded coverage.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Test changes were approved by a test gap analysis review
- [ ] #3 All relevant tests pass successfully
- [ ] #4 The project builds successfully
<!-- DOD:END -->
