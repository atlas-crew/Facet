---
id: TASK-214
title: Reorganize AppShell sidebar navigation groups
status: Done
assignee:
  - Codex
created_date: '2026-05-04 21:43'
updated_date: '2026-05-04 21:57'
labels:
  - navigation
  - shell
  - ux
dependencies: []
references:
  - src/components/AppShell.tsx
  - src/test/AppShell.test.tsx
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reorder the main sidebar into a clearer job-search progression with Overview as a standalone entry, followed by Foundation, Analyze, Apply, and Interview sections.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Overview appears as a standalone sidebar item without a section label.
- [x] #2 Foundation contains Identity.
- [x] #3 Analyze contains Research and Match in that order.
- [x] #4 Apply contains Build, Letters, LinkedIn, and Recruiter in that order.
- [x] #5 Interview contains Pipeline, Prep, and Debrief in that order.
- [x] #6 Route context and active navigation tests cover the new grouping labels.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update `NAV_ITEMS` so the home destination is labeled Overview while keeping the existing `/` route and brand-home link intact.
2. Replace the current Core/Execution/Output sidebar grouping with a standalone overview group plus Foundation, Analyze, Apply, and Interview groups in the requested order.
3. Adjust AppShell route-context tests to assert the new sidebar labels, order, active state, and route eyebrows.
4. Run focused AppShell tests, lint the touched files, run typecheck, update TASK-214, then commit the scoped files with `cortex git commit`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the AppShell sidebar taxonomy as Overview (solo with no visible group label), Foundation/Identity, Analyze/Research+Match, Apply/Build+Letters+LinkedIn+Recruiter, and Interview/Pipeline+Prep+Debrief. Route-context eyebrows now use Workspace Overview/Foundation Workspace/Analyze Workspace/Apply Workspace/Interview Workspace.

Verification passed: npx vitest run src/test/AppShell.test.tsx (31 tests), npx eslint src/components/AppShell.tsx src/test/AppShell.test.tsx, npm run typecheck, npm run build, and git diff --check on touched files. Build emitted the existing Vite chunk-size warning only.

Independent source review artifact: .agents/reviews/review-20260504-175509.md. It reported a P1 stale-taxonomy concern, but live grep verified decision-10 already documents the requested Overview/Foundation/Analyze/Apply/Interview taxonomy and AppShell tests assert the new labels/eyebrows, so this was treated as a false positive. Independent test audit passed cleanly with no prioritized gaps: .agents/reviews/test-audit-20260504-175623.md.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Reorganized the AppShell sidebar into the requested journey taxonomy: Overview as a solo item without a visible group label, Foundation with Identity, Analyze with Research and Match, Apply with Build/Letters/LinkedIn/Recruiter, and Interview with Pipeline/Prep/Debrief. Updated AppShell tests to lock in ordering, route eyebrows, active nav state, the hidden Overview group label behavior, and labelled group accessibility wiring.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
