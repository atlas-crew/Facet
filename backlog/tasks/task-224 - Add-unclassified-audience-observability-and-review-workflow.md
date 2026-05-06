---
id: TASK-224
title: Add unclassified-audience observability and review workflow
status: To Do
assignee: []
created_date: '2026-05-06 07:33'
updated_date: '2026-05-06 20:29'
labels:
  - audience-tagging
  - observability
  - ux
milestone: m-28
dependencies: []
references:
  - src/utils/audienceFilter.ts
  - src/utils/audienceRules.ts
  - src/types/audience.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

The `'unclassified'` audience tag is a fail-closed sentinel — items tagged `unclassified` never reach a production audience by design. This is correct behavior for misconfigured rules, but if it happens silently, content disappears with no signal. Without observability, the failure mode is invisible: candidate sees blank sections, recruiter card has missing reasons, and nobody knows why.

## What

Add three layers of visibility:
1. Per-JDAnalysis counter: number of insights tagged `unclassified` in the projection. Surface in the dev console / debug panel.
2. Dev-mode warn log when `unclassified` count exceeds a threshold (e.g., > 10% of insights). Logs once per analysis to avoid noise.
3. "Review unclassified" workflow path in the candidate identity-management view: shows the unclassified insights with their context, lets the user manually re-tag.

## Acceptance criteria

- `unclassifiedCount` exposed on JDAnalysis projections
- Dev-mode console.warn fires above threshold
- Identity-management workflow shows unclassified items with re-tag UI
- Tests cover threshold logic and projection counts
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
