---
id: TASK-93
title: >-
  Investigate Playwright webServer env merge without redundant process.env
  spread
status: To Do
assignee: []
created_date: '2026-04-07 22:26'
labels:
  - playwright
dependencies: []
references:
  - ./.agents/reviews/review-20260407-182509.md
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deferred from source review artifact ./.agents/reviews/review-20260407-182509.md.

Reviewer noted that spreading process.env inside playwright.config.ts webServer.env is redundant. In this repo, removing the spread caused the Playwright web server to time out during startup after moving away from the POSIX-only inline env assignment. This needs a scoped investigation to determine the minimal cross-platform env shape that both passes review and keeps preview startup reliable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Reproduce why webServer.env without process.env spread times out in this repo.
- [ ] #2 Land the minimal cross-platform configuration that preserves reliable scanner Playwright startup.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce the timeout with a minimal env object in Playwright webServer config.
2. Identify which inherited variables are actually required for npm build/preview startup in this environment.
3. Replace the broad spread with the smallest correct env configuration and rerun scanner Playwright coverage plus source review.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Documentation has been created/modified/removed as needed.
- [ ] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [ ] #4 Test changes were approved by a test gap analysis review
- [ ] #5 Changes to integration points are covered by tests
- [ ] #6 All tests pass successfully
- [ ] #7 Automatic formatting was applied.
- [ ] #8 Linters report no WARNINGS or ERRORS
- [ ] #9 The project builds successfully
<!-- DOD:END -->
