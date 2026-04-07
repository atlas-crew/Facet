---
id: TASK-92
title: Expand medium priority identity scanner browser fixtures
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
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deferred from test audit artifacts /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-020456.md, /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-022233.md, and /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-022611.md.

Remaining medium-severity browser acceptance gaps:
- P2-001: clear scan when no scan is loaded
- P2-002: scanned fields remain user-editable after parse
- P2-003: very long field values
- P2-004: scan persistence across route navigation
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The suite proves the page handles Clear Scan safely when no scan is loaded.
- [ ] #2 The suite proves scanned fields remain editable after parsing.
- [ ] #3 The suite covers very long parsed values without truncation at the form-control level.
- [ ] #4 The suite defines and verifies the expected scan persistence behavior across route navigation.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add medium-complexity in-memory PDF fixtures for the missing parser shapes.
2. Strengthen the current assertions so rendered bullet content is verified precisely.
3. Re-run the browser suite and a fresh test audit for the expanded coverage.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Test changes were approved by a test gap analysis review
- [ ] #3 All relevant tests pass successfully
- [ ] #4 The project builds successfully
<!-- DOD:END -->
