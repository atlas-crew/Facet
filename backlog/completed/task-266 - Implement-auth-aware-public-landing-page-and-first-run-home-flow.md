---
id: TASK-266
title: Implement auth-aware public landing page and first-run home flow
status: Done
assignee:
  - '@codex'
created_date: '2026-05-29 00:19'
updated_date: '2026-05-29 01:02'
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
modified_files:
  - src/components/AppShell.tsx
  - src/routes/public/PublicLandingPage.tsx
  - src/routes/public/publicLanding.css
  - src/routes/home/HomePage.tsx
  - src/routes/home/home.css
  - src/test/PublicLandingPage.test.tsx
  - src/test/AppShell.test.tsx
  - src/test/HomePage.test.tsx
  - brand/exports/hero/facet-primary-hero.webp
priority: medium
ordinal: 9000
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Anonymous visits to / see a public landing page while authenticated users still land on the existing Home/Overview hub.
- [x] #2 The landing page uses curated brand-library assets and locked brand vocabulary instead of ad hoc generic SaaS copy.
- [x] #3 Authenticated empty-workspace users get action-oriented onboarding inside the hub without reintroducing marketing copy.
- [x] #4 Auth CTAs, trust/pricing/privacy/source links, responsive layout, and route tests are complete.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Implement the auth-aware root route split and public landing shell.\n2. Fill the landing page with curated brand assets and locked copy.\n3. Improve authenticated empty-hub onboarding separately from public marketing.\n4. Wire CTA/trust/link polish and meta/OG behavior.\n5. Add route/auth/empty-state tests plus browser screenshot verification, then run lint/typecheck/test/build.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started implementation pass for auth-aware public landing rollout.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed auth-aware public landing rollout. Hosted signed-out / now shows a standalone brand landing page; signed-in users keep the operational hub; empty authenticated workspaces get first-run entry cards. Verification: focused Vitest, typecheck, lint, build, browser desktop/mobile QA, independent code review, and independent test audit.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 Automatic formatting was applied to touched files
- [x] #4 Regression tests pass (scoped to touched files)
- [x] #5 Linters report no warnings or errors in touched files
- [x] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
