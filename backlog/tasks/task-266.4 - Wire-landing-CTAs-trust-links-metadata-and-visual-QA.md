---
id: TASK-266.4
title: Wire landing CTAs trust links metadata and visual QA
status: To Do
assignee: []
created_date: '2026-05-29 00:21'
labels:
  - feature
  - landing
  - qa
  - auth
dependencies:
  - TASK-266.2
  - TASK-266.3
references:
  - brand/exports/social/facet-og-image-dark.webp
  - src/routes/home/HomePage.tsx
  - src/test/HomePage.test.tsx
documentation:
  - doc-44
parent_task_id: TASK-266
priority: medium
ordinal: 13000
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Primary and secondary public landing CTAs route correctly into the hosted auth/sign-in flow and any local-mode equivalent.
- [ ] #2 Trust, privacy, pricing/source, and project links either resolve to real routes/URLs or are explicitly deferred in backlog before launch.
- [ ] #3 Landing metadata and social preview use the approved brand assets and do not regress authenticated app metadata.
- [ ] #4 Desktop and mobile browser QA captures verify hero image rendering, responsive text fit, CTA behavior, and authenticated/anonymous route behavior.
- [ ] #5 Final scoped verification includes route tests plus lint/typecheck/build or a documented narrower substitute.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inventory current auth CTA wiring, metadata setup, and any existing legal/source/pricing routes.\n2. Wire CTA destinations and link targets from the public landing shell.\n3. Configure route-level metadata/social image if supported by the app structure.\n4. Run browser QA for desktop and mobile plus final automated checks.\n5. Close or file follow-up backlog items for intentionally deferred public pages.
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
