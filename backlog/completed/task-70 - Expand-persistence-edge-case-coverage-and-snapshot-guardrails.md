---
id: TASK-70
title: Expand persistence edge-case coverage and snapshot guardrails
status: Done
assignee:
  - Codex
created_date: '2026-03-11 20:38'
updated_date: '2026-03-12 11:52'
labels:
  - remediation
  - persistence
  - testing
dependencies: []
references:
  - .agents/reviews/review-20260311-163608.md
  - .agents/reviews/test-audit-20260311-163608.md
  - .agents/reviews/review-20260311-210237.md
  - .agents/reviews/test-audit-20260311-210447.md
  - .agents/reviews/review-20260312-074935.md
  - .agents/reviews/test-audit-20260312-074935.md
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up from TASK-69 review and test-audit. Capture the remaining low-priority persistence hardening gaps that are not blocking current coordinator work: broader artifact validation coverage, structuredClone-specific clone behavior, explicit cold-start coordinator assertions, and a few additional snapshot contract guardrails.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Persistence tests cover the remaining artifact validation branches for prep, cover letters, and research payloads.
- [x] #2 cloneValue behavior is explicitly documented by tests for both structuredClone and fallback-specific edge cases.
- [x] #3 Coordinator tests pin the remaining cold-start and contract edge cases called out by review or audit without broadening the persistence surface area unexpectedly.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-03-11 Codex follow-up from TASK-68 closeout: keep the remaining non-blocking runtime gaps here instead of stretching TASK-68 further. Residual coverage asks from the fresh audit are explicit suppressSaves assertions during hydration, non-Error fallback branches in bootstrap/autosave, default local-preferences backend selection, and a workspace-hydration path with no saved local preferences. Review follow-up also captured remote backend hardening for non-JSON upstream failures and clearer transport-security/dev-key guidance, plus a user-facing retry/degraded-mode path for bootstrap failures instead of console-only logging.

2026-03-12: Starting TASK-70 to close the last persistence-specific hardening gaps after TASK-71/TASK-72. The first step is to compare the task acceptance criteria against the current clone/coordinator/validation tests and target only the remaining low-priority guardrail cases.

2026-03-12: Expanded persistence guardrail coverage in src/test/persistence.test.ts for the remaining prep, cover-letter, and research payload validation branches, plus direct structuredClone-path assertions and normalized non-Error bootstrap handling.

2026-03-12: Expanded src/test/persistenceRuntime.test.ts to cover hydrate-without-local-preferences startup, local-preferences backend fallback when indexedDB is unavailable, suppressSaves/no-bootstrap-writeback behavior, and normalized non-Error bootstrap/autosave runtime failures.

2026-03-12: Verification passed with npm run typecheck, npx vitest run src/test/persistence.test.ts src/test/persistenceRuntime.test.ts, npx eslint src/test/persistence.test.ts src/test/persistenceRuntime.test.ts, npm run test, and npm run build.

2026-03-12: Independent code review rerun in .agents/reviews/review-20260312-074935.md returned CLEAN. Test-audit rerun in .agents/reviews/test-audit-20260312-074935.md still surfaced broader persistence resilience follow-up work outside this narrow slice, so that remainder was captured as TASK-73 instead of stretching TASK-70 further.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Expanded the last low-priority persistence guardrail tests without widening the production surface area. The slice closes the remaining artifact validation branches, pins native structuredClone and non-Error bootstrap behavior, and adds runtime coverage for cold-start hydration without local preferences, default local-preferences backend fallback, suppressSaves/no-writeback startup behavior, and normalized autosave/bootstrap failure states. Verification passed with focused persistence tests, targeted lint, full npm run test, and npm run build; broader resilience gaps raised by the audit were preserved as follow-up TASK-73.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [ ] #2 Documentation has been created/modified/removed as needed.
- [ ] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [ ] #4 Test changes were approved by a test gap analysis review
- [x] #5 Changes to integration points are covered by tests
- [x] #6 All tests pass successfully
- [ ] #7 Automatic formatting was applied.
- [x] #8 Linters report no WARNINGS or ERRORS
- [x] #9 The project builds successfully
<!-- DOD:END -->
