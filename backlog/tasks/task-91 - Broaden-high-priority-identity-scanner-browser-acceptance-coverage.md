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
  - /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-024540.md
  - /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-031521.md
  - /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-031956.md
  - /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-032434.md
  - /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-033156.md
  - /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-033718.md
  - /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-105655.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deferred from test audit artifacts /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-020456.md, /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-022233.md, /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-022611.md, /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-023903.md, /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-024540.md, /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-031521.md, /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-031956.md, /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-032434.md, /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-033156.md, /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-033718.md, and /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-105655.md.

Remaining high-priority browser acceptance gaps:
- P1-001: error recovery when a valid upload follows a rejected PDF
- P1-002: scanned field editability after parse
- P1-003: multiple skill groups parsed and displayed with accurate counts
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The suite proves a valid upload clears a prior scan error and renders structured sections normally.
- [ ] #2 The suite proves representative scanned fields remain editable after parsing.
- [ ] #3 The suite covers multiple skill groups and verifies both rendered content and status counts.
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
