---
id: TASK-295
title: Standardize AI-action button styling and labels site-wide
status: To Do
assignee: []
created_date: '2026-06-07 20:29'
labels:
  - ui
  - design-system
  - cross-cutting
milestone: m-36
dependencies: []
priority: medium
ordinal: 51000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
AI feature buttons are currently styled and labeled inconsistently across the app, which implies (without reason) that some are more important than others. Standardize them: one consistent treatment — the blue button with the small icon — for AI actions, and one consistent verb for re-running a generation.

Label decision: the user leans toward "Refresh" over "Regenerate" (to avoid implying the output is just being "made up"), but is open to an even better term. Pick the final verb during implementation; "Refresh" is the default unless a clearly better term is agreed. Apply the chosen verb consistently everywhere.

This is cross-cutting: "Regenerate"/AI-action buttons currently appear across multiple routes — identity (IdentityMapPage, IdentityPage, bands/ThesisBand, bands/ProfilesBand, ExtractionAgentCard, IdentityEnrichmentSkillPage), research (ResearchPage), prep (PrepPage), and letters (LettersPage). Audit all AI-action buttons, not only these.

Prefer extracting/using a single shared AI-action button component or a shared class so the treatment can't drift again. Follow docs/development/ui/facet-style-guide.md and the React-component extraction deferral policy noted there.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All AI-action buttons across the site use one consistent visual treatment (blue button with the small icon)
- [ ] #2 A single verb is chosen for re-running a generation and applied everywhere (default 'Refresh' unless a better term is agreed)
- [ ] #3 An audit confirms no AI-action button retains a divergent style or label after the change
- [ ] #4 The standard treatment is provided via a shared component or shared class to prevent future drift
- [ ] #5 Routes covered include at least identity, research, prep, and letters
- [ ] #6 No hardcoded colors/spacing; uses design-system tokens
- [ ] #7 Change follows the style guide's component-extraction deferral policy
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
