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
  - /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-023903.md
  - /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-031521.md
  - /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-031956.md
  - /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-032434.md
  - /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-033156.md
  - /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-033718.md
  - /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-105655.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deferred from test audit artifacts /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-020456.md, /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-022233.md, /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-022611.md, /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-023903.md, /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-031521.md, /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-031956.md, /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-032434.md, /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-033156.md, /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-033718.md, and /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-105655.md.

Remaining medium-severity browser acceptance gaps:
- P2-001: multiple education entries parsed and displayed
- P2-002: multiple project entries parsed and displayed
- P2-003: loading indicator during parse
- P2-004: link normalization breadth and edge cases
- P2-005: section-count assertions beyond single-item happy paths
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The suite covers multiple education entries with correct fields and count badges.
- [ ] #2 The suite covers multiple project entries with correct names, descriptions, and counts.
- [ ] #3 The suite asserts visible loading-state behavior while a scan is in progress.
- [ ] #4 The suite covers additional link-normalization variants and resulting link text.
- [ ] #5 The suite asserts section counts for multi-item skills, projects, and education fixtures.
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
