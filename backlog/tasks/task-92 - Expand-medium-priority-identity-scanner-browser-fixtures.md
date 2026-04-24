---
id: TASK-92
title: Expand medium priority identity scanner browser fixtures
status: To Do
assignee: []
created_date: '2026-04-07 02:07'
updated_date: '2026-04-07 22:13'
labels:
  - scanner
  - testing
  - playwright
dependencies: []
references:
  - ./.agents/reviews/test-audit-20260407-181109.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deferred from scanner browser audits, most recently ./.agents/reviews/test-audit-20260407-181109.md.

Remaining medium-priority browser acceptance gaps:
- P2-001: extreme string length handling in parsed fields
- P2-002: invalid or incomplete date parsing coverage
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The suite covers an extremely long parsed string and asserts the UI remains usable without structural breakage.
- [ ] #2 The suite covers irregular date text and verifies the parsed role preserves the raw date string without failing extraction.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add an extreme-string PDF fixture and assert the rendered scanner UI stays intact.
2. Add an irregular-date PDF fixture and assert the raw date text is preserved in the role editor.
3. Re-run the browser suite and a fresh test audit.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Test changes were approved by a test gap analysis review
- [ ] #3 All relevant tests pass successfully
- [ ] #4 The project builds successfully
<!-- DOD:END -->
