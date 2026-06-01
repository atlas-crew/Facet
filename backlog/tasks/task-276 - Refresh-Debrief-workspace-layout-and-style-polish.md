---
id: TASK-276
title: Refresh Debrief workspace layout and style polish
status: To Do
assignee: []
created_date: '2026-06-01 19:05'
labels:
  - feature
  - debrief
  - design
dependencies: []
references:
  - TODO.md
  - src/routes/debrief/DebriefPage.tsx
  - src/routes/debrief/debrief.css
documentation:
  - docs/development/ui/facet-style-guide.md
priority: medium
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TODO.md flags /debrief as needing a style pass: padding, spacing, and overall visual fit. Current DebriefPage uses a relatively plain sidebar/panel layout with route-scoped debrief.css and should be brought closer to the current Facet workspace shell/design-system expectations without changing the debrief data model.

Placement: Debrief is an interview/outcome-touching workspace tied to application context. This task is UI polish only unless implementation discovery identifies a blocker that deserves a separate data-flow task.

Scope notes:
- Read docs/development/ui/facet-style-guide.md before implementation.
- Keep the existing debrief workflow intact: create session, capture notes/stories, generate report, export/download, apply identity draft.
- Prioritize responsive padding, section hierarchy, card density, empty/session states, and alignment with other workspace routes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Debrief spacing, padding, section hierarchy, and responsive behavior match current Facet workspace design conventions.
- [ ] #2 Existing create/generate/export/apply flows remain available and keep their current behavior.
- [ ] #3 Empty state, session list, capture form, pattern summary, and active report areas are visually coherent at desktop and mobile widths.
- [ ] #4 Focused route tests or visual regression coverage verify the main Debrief states that changed.
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
