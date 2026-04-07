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
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deferred from test audit artifacts /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-020456.md, /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-022233.md, /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-022611.md, /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-023903.md, /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-024540.md, /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-031521.md, /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-031956.md, /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-032434.md, and /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-033156.md.

Remaining high-priority browser acceptance gaps:
- P1-001: max file size limits for oversized PDF uploads
- P1-002: network or server failure handling if scanning ever moves off the client path
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The suite covers oversized PDF rejection with an explicit user-facing error path.
- [ ] #2 If the scanner path gains network dependencies, the suite covers backend failure recovery explicitly.
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
