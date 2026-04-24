---
id: TASK-91
title: Broaden high priority identity scanner browser acceptance coverage
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
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deferred from scanner browser audits, most recently ./.agents/reviews/test-audit-20260407-181109.md.

Remaining high-priority browser acceptance gaps:
- P1-001: network and server error handling during scan/upload
- P1-002: drag-and-drop upload interaction coverage
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The suite mocks a scanner network or server failure and verifies a user-visible error plus responsive recovery.
- [ ] #2 The suite verifies a valid PDF upload through drag-and-drop, not just the file input path.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add Playwright coverage for a mocked scan failure path that leaves the UI recoverable.
2. Add a drag-and-drop upload test using a real PDF payload.
3. Re-run the browser suite and a fresh test audit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-04-07: Closed P1-001 with browser coverage in tests/identity-scanner.spec.ts (`recovers with a valid pdf after a rejected upload`). Verified with `npx playwright test tests/identity-scanner.spec.ts --project=chromium --workers=1` and audit artifact ./.agents/reviews/test-audit-20260407-162400.md.

2026-04-07: Closed prior high-priority gaps for rejected-upload recovery, field editability, multi-skill-group parsing, reload persistence, route persistence, paste fallback recovery, page-spanning bullets, and clear-during-rescan cancellation. Verified by npx playwright test tests/identity-scanner.spec.ts --project=chromium --workers=1 and audit artifact ./.agents/reviews/test-audit-20260407-181109.md.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Test changes were approved by a test gap analysis review
- [ ] #3 All relevant tests pass successfully
- [ ] #4 The project builds successfully
<!-- DOD:END -->
