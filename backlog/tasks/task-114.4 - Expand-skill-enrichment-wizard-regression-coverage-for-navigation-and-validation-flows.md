---
id: TASK-114.4
title: >-
  Expand skill enrichment wizard regression coverage for navigation and
  validation flows
status: In Progress
assignee:
  - '@codex'
created_date: '2026-04-12 23:13'
updated_date: '2026-05-08 20:45'
labels:
  - identity
  - skill-enrichment
  - tests
dependencies: []
references:
  - src/routes/identity/IdentityEnrichmentSkillPage.tsx
  - src/test/IdentityEnrichmentSkillPage.test.tsx
  - .agents/reviews/test-audit-20260412-190953.md
modified_files:
  - src/test/IdentityEnrichmentSkillPage.test.tsx
  - >-
    backlog/tasks/task-114.4 -
    Expand-skill-enrichment-wizard-regression-coverage-for-navigation-and-validation-flows.md
parent_task_id: TASK-114
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Cover the remaining high-signal wizard behaviors called out by the independent test audit: required-depth validation, skip flow, dirty-navigation confirms, back-to-overview confirms, and cleanup/abort handling for in-flight AI requests.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The wizard test suite covers save validation when depth is missing.
- [x] #2 The wizard test suite covers skip behavior and disabled skip state for complete skills.
- [x] #3 The wizard test suite covers dirty-confirmation behavior for next/previous navigation and back-to-overview.
- [x] #4 The wizard test suite covers unmount or route-change cleanup for in-flight AI requests.
- [x] #5 Targeted wizard tests pass after the new coverage is added.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Implementation plan:
1. Extend src/test/IdentityEnrichmentSkillPage.test.tsx with focused regression cases for required-depth validation, skip behavior, dirty navigation confirmations, and AI request abort cleanup.
2. Prefer real component behavior assertions over mock-shape assertions; keep production untouched unless a behavior/testability bug appears.
3. Run the targeted IdentityEnrichmentSkillPage Vitest file first, then run task DoD checks (format/check, lint, build, and broader tests as feasible) and capture exact receipts.
4. Update TASK-114.4 acceptance criteria/notes/final summary only through backlog CLI, then commit the narrow changed files with cortex git commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-05-08 TASK-114.4 evidence:
- Added IdentityEnrichmentSkillPage regression coverage in src/test/IdentityEnrichmentSkillPage.test.tsx for missing-depth save validation, pending/complete skip behavior, dirty next/previous/back-to-overview confirmations, clean navigation no-confirm behavior, and aborting an in-flight AI draft when the routed skill changes.
- Targeted pass: pnpm exec vitest run src/test/IdentityEnrichmentSkillPage.test.tsx -> 1 file passed, 27 tests passed.
- Formatting: pnpm exec prettier --write src/test/IdentityEnrichmentSkillPage.test.tsx; pnpm exec prettier --check src/test/IdentityEnrichmentSkillPage.test.tsx -> pass.
- Targeted lint: pnpm exec eslint src/test/IdentityEnrichmentSkillPage.test.tsx -> pass.
- Build: pnpm run build -> pass.
- Initial scoped diff-test-audit artifact: .agents/reviews/test-audit-20260508-164209.md; Claude returned no P0/P1 and P2 suggestions for clean navigation and stronger abort/store assertions, which were remediated in the test file.
- Final scoped diff-test-audit artifact: .agents/reviews/test-audit-20260508-164406.md; result: no prioritized gaps, covered 6, shallow 0, missing 0, P0/P1/P2 all 0.
- Repo-wide pnpm run test is blocked by unrelated failures outside this lane: PrepPage.behavior.test.tsx, ResearchPage.test.tsx, facetServer.test.ts, jdAnalysis.test.ts, searchRedesignRoundTrip.test.tsx, and workspaceBackup.test.ts.
- Repo-wide pnpm run lint is blocked by existing generated/output and unrelated source lint findings, including .vercel/output/static/assets/pdf.worker-2htIQpfR.mjs, dist-unmin-* assets, src/hooks/useElapsed.ts, src/routes/identity/inspectorSlots/slotPrimitives.tsx, src/routes/prep/PrepCardView.tsx, and tests/hosted/*.spec.ts.
- TASK-114.4 remains In Progress because repo-wide pnpm run test and pnpm run lint are still blocked by unrelated failures, so DoD #3 and #5 are not honestly satisfied.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
