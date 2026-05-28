---
id: TASK-53
title: >-
  Accessibility: keyboard/focus/labels polish for Pipeline/Prep/Letters modals
  and icon actions
status: In Progress
assignee:
  - '@codex'
created_date: '2026-03-10 03:54'
updated_date: '2026-05-28 14:07'
labels:
  - accessibility
  - remediation
milestone: m-1
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend a11y polish beyond the build library: ensure modals trap focus consistently, icon-only buttons are labeled, and focus rings are high-contrast across Pipeline/Prep/Letters flows.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All modals across Pipeline/Prep/Letters trap focus, close on Escape, and restore focus to the launcher.
- [ ] #2 Icon-only buttons have accessible names (aria-label or visible text).
- [ ] #3 Focus indication meets contrast/visibility expectations in dark theme.
- [ ] #4 Verification commands pass.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Codex starting TASK-53. Plan: inspect shared focus trap/modal primitives and Pipeline/Prep/Letters modal/icon surfaces; implement the narrowest shared a11y hardening for focus trap, Escape close, launcher focus restore, icon labels, and visible focus rings; add regression tests; run review/audit/lint/build; commit via cortex.
<!-- SECTION:NOTES:END -->

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
