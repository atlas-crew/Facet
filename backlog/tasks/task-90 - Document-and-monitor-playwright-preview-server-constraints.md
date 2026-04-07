---
id: TASK-90
title: Document and monitor Playwright preview server constraints
status: To Do
assignee: []
created_date: '2026-04-07 02:07'
labels:
  - testing
  - playwright
dependencies: []
references:
  - /Users/nick/Developer/Facet/.agents/reviews/review-20260407-020352.md
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deferred from source review artifact /Users/nick/Developer/Facet/.agents/reviews/review-20260407-020352.md.

Remaining low-severity follow-ups:
- P3-001: local Playwright runs can reuse a stale preview server when port 4173 is already occupied
- P3-002: the 120s build-plus-preview timeout may become tight on slower CI runners
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The contributor workflow documents how Playwright preview reuse behaves locally and how to force a rebuild when needed.
- [ ] #2 CI build durations are checked and the 120s timeout is either validated as sufficient or increased with rationale.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Decide whether the right fix is documentation, config hardening, or both.
2. Update the relevant testing guidance or Playwright config comments/scripts.
3. Verify the documented workflow against a local Playwright run and CI timing data.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Documentation has been created/modified/removed as needed.
- [ ] #2 Documentation changes were approved by the docs-architect (8/10 score required)
- [ ] #3 All relevant tests pass successfully
- [ ] #4 The project builds successfully
<!-- DOD:END -->
