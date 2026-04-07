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
  - /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-022233.md
  - /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-022611.md
  - /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-023903.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deferred from test audit artifacts /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-020456.md, /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-022233.md, /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-022611.md, and /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-023903.md.

Remaining high-priority browser acceptance gaps:
- P1-001: valid PDF with no parseable resume structure
- P1-002: role entries with zero bullets
- P1-003: clear-scan control unavailable before first scan
- P1-004: multiple skill groups parsed independently
- P1-005: multiple projects parsed and counted
- P1-006: multiple education entries parsed and counted
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The suite covers a valid PDF with no resume structure and verifies graceful fallback or empty-state behavior.
- [ ] #2 The suite covers a role card with zero bullets and verifies the next section still parses correctly.
- [ ] #3 The suite verifies the Clear Scan control is absent or disabled before any scan exists.
- [ ] #4 The suite covers multiple skill groups and verifies they render independently.
- [ ] #5 The suite covers multiple projects and multiple education entries with count assertions above 1.
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
