---
id: TASK-266.2
title: Build brand-backed public landing content and responsive visual system
status: To Do
assignee: []
created_date: '2026-05-29 00:21'
labels:
  - feature
  - landing
  - brand
  - ux
dependencies:
  - TASK-266.1
references:
  - brand/CHEATSHEET.md
  - brand/COPY.md
  - brand/BRAND.md
  - brand/exports/hero/facet-primary-hero.webp
  - brand/exports/method/facet-method-dark.webp
  - brand/exports/concepts/facet-identity-dark.webp
  - docs/development/ui/facet-style-guide.md
documentation:
  - doc-44
parent_task_id: TASK-266
priority: medium
ordinal: 11000
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Public landing hero uses the curated Facet hero asset and keeps text in HTML, not baked into images.
- [ ] #2 Landing page sections explain the identity model, vectors/recuts, trust posture, and core workflow using brand-approved vocabulary.
- [ ] #3 Copy follows brand locked phrases and avoids banned generic AI/SaaS terms from brand/CHEATSHEET.md.
- [ ] #4 Desktop and mobile layouts render cleanly with no overlapping text, image cropping surprises, or authenticated-app shell leakage.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inventory the selected brand exports and confirm paths that should ship in the app bundle.\n2. Draft the public landing component content from brand/CHEATSHEET.md and brand/COPY.md.\n3. Implement responsive layout/CSS aligned with the Facet style guide.\n4. Add component or route tests for key copy/CTA presence and run scoped verification.
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
