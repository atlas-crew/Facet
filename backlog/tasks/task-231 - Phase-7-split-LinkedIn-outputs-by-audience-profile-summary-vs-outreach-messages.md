---
id: TASK-231
title: >-
  Phase 7: split LinkedIn outputs by audience (profile summary vs outreach
  messages)
status: Done
assignee:
  - '@codex'
created_date: '2026-05-06 20:28'
updated_date: '2026-05-26 22:19'
labels:
  - audience-tagging
  - phase-7
  - linkedin
milestone: m-28
dependencies: []
references:
  - src/utils/linkedinGenerator.ts
  - src/routes/linkedin/LinkedInPage.tsx
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

LinkedIn workspace produces multiple artifacts: profile summary (candidate-facing self-description) vs outreach messages (recruiter/HM-facing pitches). They have different audiences but currently share an undifferentiated input.

## What

- Identify each LinkedIn output type and its target audience
- Apply `projectForAudience` per output: summary → 'candidate', outreach → 'recruiter' or 'hiring_manager' depending on recipient
- Update generators to take JDAnalysis and use audience-projected content
- Tests rebuild fixtures with audience-aware shapes

## Acceptance criteria

- Profile summary generator uses candidate projection
- Outreach generators use recruiter/HM projection per recipient
- Tests confirm content sourcing matches audience expectations
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-05-26 Codex starting TASK-231 as part of three-surface audience push with TASK-232/TASK-236. Plan: inspect LinkedIn generators/page output types, apply candidate vs recruiter/hiring-manager projections at JDAnalysis boundaries, add focused audience-aware fixtures/tests, verify with scoped/full gates and independent review/audit before close.

Implemented LinkedIn audience output routing: profile summary uses candidate projection, recruiter and hiring-manager outreach use recipient projections, optional latest JD context can be toggled off, outreach fields persist/export, and focused generator/page tests cover projections, schema validation, migration, editing, and export. Verification: focused Vitest suite, typecheck, lint, build, specialist review, and split diff-test audits.
<!-- SECTION:NOTES:END -->
