---
id: TASK-193
title: Harden overview hub edge-case coverage
status: To Do
assignee:
  - Codex
created_date: '2026-04-28 01:49'
labels:
  - test
  - ux
  - overview
dependencies: []
references:
  - src/routes/home/HomePage.tsx
  - src/test/HomePage.test.tsx
  - .agents/reviews/test-audit-20260427-214727.md
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up from TASK-191 final test-audit artifact .agents/reviews/test-audit-20260427-214727.md. The overview hub has no remaining P0/P1 gaps, but the auditor identified P2 hardening around pipeline glance no-awaiting/empty copy, complete passive next-step token coverage, latest prep deck ordering, notification group aria wiring, and the secondary scheduled-round formatter fallback.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Pipeline glance tests cover zero active entries and active entries with zero awaiting-action suffix.
- [ ] #2 Passive next-step tests cover every regex token: waiting, wait, monitor, no action, n/a, none, and dash.
- [ ] #3 Prep deck selection tests verify newest updatedAt wins across multiple decks.
- [ ] #4 Notification tests assert role=group and aria-labelledby wiring.
- [ ] #5 Formatter fallback behavior is either covered or simplified to remove unreachable fallback copy.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
