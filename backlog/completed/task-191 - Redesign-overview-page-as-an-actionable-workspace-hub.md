---
id: TASK-191
title: Redesign overview page as an actionable workspace hub
status: Done
assignee:
  - Codex
created_date: '2026-04-28 01:12'
updated_date: '2026-04-28 01:49'
labels:
  - ux
  - overview
  - workspace-hub
dependencies: []
references:
  - src/routes/home/HomePage.tsx
  - src/routes/home/home.css
  - src/test/HomePage.test.tsx
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Redesign the authenticated overview page so it behaves like a workspace hub: orient the user to what to do next, resume meaningful unfinished work, keep notifications quiet and time-sensitive, present the pipeline as an actionable gateway, and preserve the existing Facet dark visual register. Remove marketing/workflow-explainer content from the hub surface.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Overview page prioritizes one or two active-work resume affordances over marketing or completion metrics.
- [x] #2 Notifications section is quiet by default and only surfaces time-sensitive or materially actionable items.
- [x] #3 Pipeline glance is framed as a gateway with awaiting-action copy and a clear link to Pipeline.
- [x] #4 Existing start-new entry points for resume import, JD import, and direct editing remain available and visually consistent.
- [x] #5 Marketing/workflow explainer copy is removed from the authenticated hub, with focused tests updated for the new IA.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect HomePage data sources, styling, and tests to understand existing hub content and available workspace state.\n2. Replace the marketing-style hero/overview content with a compact hub layout: active work, quiet notifications, pipeline glance, and existing start-new entry points.\n3. Keep the current visual register (dark surface, subtle borders, diamond/cyan accent) while reducing page sprawl and avoiding a large landing-page hero.\n4. Update focused HomePage tests for the new information architecture and run targeted verification plus typecheck/build as appropriate.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Redesigned the authenticated overview page into a compact workspace hub: active-work resume cards, strict time-sensitive notifications with durable dismissal, a pipeline gateway, and preserved start-new entry points. Removed the marketing hero/workflow/output explainer sections. Added focused HomePage regression coverage for active-work priority, scan gating, stale JD reminders, scheduled rounds, dismissal persistence/pruning, timer refresh, storage failure handling, and core accessibility affordances. Review/audit artifacts: .agents/reviews/review-20260427-212030.md, .agents/reviews/review-20260427-212405.md, .agents/reviews/review-20260427-212837.md, .agents/reviews/test-audit-20260427-214727.md. Follow-ups filed: TASK-192 and TASK-193. Verification: npx vitest run src/test/HomePage.test.tsx; npx eslint src/routes/home/HomePage.tsx src/test/HomePage.test.tsx; npm run typecheck; npm run build.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
