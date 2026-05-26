---
id: TASK-246.1
title: Refactor search run refresh polling and live-region follow-ups
status: To Do
assignee: []
created_date: '2026-05-26 04:24'
updated_date: '2026-05-26 04:45'
labels:
  - research
  - review-debt
  - staleness
dependencies: []
references:
  - .agents/reviews/review-20260526-004326.md
  - .agents/reviews/review-20260526-002232.md
modified_files:
  - src/routes/research/ResearchPage.tsx
parent_task_id: TASK-246
priority: low
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deferred non-blocking findings from TASK-246 independent review. Review artifact: .agents/reviews/review-20260526-004326.md. Earlier source review artifact: .agents/reviews/review-20260526-002232.md.

Findings deferred:
- P2-001/P2-002: applyResearchJobUpdate now contains dense search-run refresh completion logic; extract a finalizeRunRefreshReview helper.
- P3-001: queueRunRefreshConfirmation and confirmRunRefresh duplicate prerequisite validation; extract shared validation.
- P3-002: conditionally mounted aria-live regions may be missed by some screen readers; consider persistent live containers for confirmation/progress announcements.
- P3-003: Search Launcher has a redundant inner !effectiveProfile fallback after the parent panel gate; remove unreachable dead code.

Why deferred: TASK-246 blockers and behavior tests are resolved; these are maintainability/accessibility refinements that can land separately without changing the shipped run-refresh behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Run refresh completion review stamping is extracted from the polling callback without behavior changes.
- [ ] #2 Run refresh prerequisite validation is shared between queue and confirm paths.
- [ ] #3 Run refresh confirmation/progress announcements use a persistent live-region pattern or an equivalent accessible announcement mechanism.
- [ ] #4 Remove the redundant Search Launcher effectiveProfile fallback without behavior changes.
<!-- AC:END -->



## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Regression tests pass (scoped to touched files)
- [ ] #5 Linters report no warnings or errors in touched files
- [ ] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
