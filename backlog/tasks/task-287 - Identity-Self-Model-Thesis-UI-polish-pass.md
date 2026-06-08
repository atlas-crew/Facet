---
id: TASK-287
title: Identity Self Model & Thesis UI polish pass
status: In Progress
assignee:
  - '@codex'
created_date: '2026-06-07 20:27'
updated_date: '2026-06-08 01:16'
labels:
  - identity
  - ui-polish
milestone: m-35
dependencies: []
priority: low
ordinal: 43000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Spacing, semantic-color, and duplicate-copy cleanup across the Identity Map Self Model and Thesis areas. These are small visual/copy issues captured during triage; group them into one reviewable polish PR rather than micro-PRs.

Scope (from triage):
- Self Model: excess padding / empty space near the "Generate self-knowledge" button; the same empty-space problem appears in the strategic positioning area.
- "Interview Self Knowledge" section: add semantic coloring consistent with the UI design system, and fix the spacing after bullets.
- Thesis: the explanatory text for the fill-strength labels (e.g. "solid") rendered below the thesis text duplicates the help-chip text — remove the duplication; also fix the padding around the "Regenerate thesis" button.
- Bullet detail view (left rail / BulletInspector): add bottom padding — content is slightly cutting off the bottom buttons.

Relevant files: src/routes/identity/bands/SelfModelBand.tsx, src/routes/identity/bands/ThesisBand.tsx, src/routes/identity/inspectorSlots/ThesisInspector.tsx, src/routes/identity/inspectorSlots/BulletInspector.tsx, src/routes/identity/identityMap.css (.self-knowledge-* rules). Follow docs/development/ui/facet-style-guide.md for tokens and semantic color usage; all spacing on the 4px grid.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Self Model area around the Generate self-knowledge button has no excess empty space; padding follows the 4px grid
- [ ] #2 Strategic positioning area no longer shows the same empty-space gap
- [ ] #3 Interview Self Knowledge section uses semantic color tokens consistent with the style guide and has correct spacing after bullets
- [ ] #4 Thesis no longer renders explanatory label text that duplicates the help-chip content
- [ ] #5 Padding around the Regenerate thesis button is corrected
- [ ] #6 Bullet detail left rail has bottom padding so the bottom buttons are no longer clipped
- [ ] #7 No hardcoded colors or off-grid spacing introduced; values use CSS custom properties
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
