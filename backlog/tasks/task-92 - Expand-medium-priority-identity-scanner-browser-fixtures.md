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
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deferred from test audit artifact /Users/nick/Developer/Facet/.agents/reviews/test-audit-20260407-020456.md.

Remaining medium-severity browser acceptance gaps:
- P2-001: multiple skill categories
- P2-002: multiple education entries
- P2-003: unicode and international characters
- P2-004: role date format variations
- P2-005: empty or non-resume PDF content
- P2-006: current role bullet assertions are shallow
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The browser acceptance fixtures include multiple skill groups, multiple education entries, and role date variants.
- [ ] #2 The suite covers non-ASCII content and verifies rendered values survive PDF extraction.
- [ ] #3 The suite covers a valid but non-resume PDF and verifies the fallback/error behavior.
- [ ] #4 The suite strengthens bullet assertions beyond a single hasText check.
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
