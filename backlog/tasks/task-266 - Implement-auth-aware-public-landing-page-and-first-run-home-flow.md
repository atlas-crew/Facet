---
id: TASK-266
title: Implement auth-aware public landing page and first-run home flow
status: To Do
assignee: []
created_date: '2026-05-29 00:19'
labels:
  - feature
  - landing
  - homepage
  - brand
dependencies: []
references:
  - brand/CHEATSHEET.md
  - brand/COPY.md
  - brand/BRAND.md
  - backlog/docs/doc-33
  - backlog/completed/task-191
documentation:
  - doc-44
priority: medium
ordinal: 9000
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Anonymous visits to / see a public landing page while authenticated users still land on the existing Home/Overview hub.
- [ ] #2 The landing page uses curated brand-library assets and locked brand vocabulary instead of ad hoc generic SaaS copy.
- [ ] #3 Authenticated empty-workspace users get action-oriented onboarding inside the hub without reintroducing marketing copy.
- [ ] #4 Auth CTAs, trust/pricing/privacy/source links, responsive layout, and route tests are complete.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Implement the auth-aware root route split and public landing shell.\n2. Fill the landing page with curated brand assets and locked copy.\n3. Improve authenticated empty-hub onboarding separately from public marketing.\n4. Wire CTA/trust/link polish and meta/OG behavior.\n5. Add route/auth/empty-state tests plus browser screenshot verification, then run lint/typecheck/test/build.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Regression tests pass (scoped to touched files)
- [ ] #5 Linters report no warnings or errors in touched files
- [ ] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
