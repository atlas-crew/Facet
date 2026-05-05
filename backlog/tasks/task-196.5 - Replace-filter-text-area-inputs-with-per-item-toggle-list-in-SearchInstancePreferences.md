---
id: TASK-196.5
title: >-
  Replace filter text-area inputs with per-item toggle list in
  SearchInstancePreferences
status: To Do
assignee: []
created_date: '2026-04-29 08:42'
labels:
  - search-redesign
  - ui
dependencies:
  - TASK-196.3
references:
  - src/routes/research/searchWorkspaceComponents.tsx
  - src/routes/research/research.css
  - src/store/searchStore.ts
  - src/routes/identity/inspectorSlots/MatchRuleInspector.tsx
  - src/test/ResearchPage.test.tsx
documentation:
  - backlog doc-34 (Search Parameters Surface — Design)
  - backlog doc-24 (Search Workspace Redesign)
parent_task_id: TASK-196
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the current text-area inputs for prioritize/avoid filters in `SearchInstancePreferences` (lines around 461 and 478 of searchWorkspaceComponents.tsx, in the existing override editor) with a list view: one row per master-list entry, with a per-search enable/disable checkbox.

Toggling a row updates `SearchInstanceFilterOverrides.disabledFilterIds` for the active search. Master-list mutation (add / edit / delete custom entries) lives on the Identity Map via the `MatchRuleInspector` slot (`src/routes/identity/inspectorSlots/MatchRuleInspector.tsx`) and is out of scope here; surface an "Edit master list" link from the search workspace that navigates to the Identity Map. The link's exact target — plain route navigation vs. deep-linking to the relevant `MatchRuleInspector` selection via `setMapSelection({ type: 'matchRule', kind, id })` — is a coordination question flagged on the parent task (TASK-196 Implementation Notes); confirm before kickoff.

Visual treatment: green/red column accents matching prioritize/avoid semantics (per the user-supplied spec). Empty master list shows guidance text directing the user to the Identity Map to add entries.

Depends on subtask .3 (the id and per-search override shape must exist before the UI can wire to them).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Prioritize and avoid sections in SearchInstancePreferences render as item-list views, one row per master-list entry, with a checkbox per row
- [ ] #2 Toggling a row's checkbox updates SearchInstanceFilterOverrides.disabledFilterIds for the active search via a searchStore action; toggling does not mutate the master list
- [ ] #3 Visual treatment differentiates prioritize (green accent) and avoid (red accent)
- [ ] #4 An 'Edit master list' link or button is present in each section; activating it navigates to the Identity Map (target depth — plain route vs. deep-linked `MatchRuleInspector` selection — confirmed against the coordination question on TASK-196 before implementation)
- [ ] #5 When the master list is empty, the section shows guidance text directing the user to the Identity Map rather than an empty checkbox list
- [ ] #6 No remaining text-area input for prioritize/avoid filters in the search workspace
- [ ] #7 Component tests cover: toggling updates only the override (master unchanged), navigation link is present and routes correctly, empty-list guidance renders, ids on toggled rows persist through store rehydration
- [ ] #8 Accessibility: each checkbox has an accessible label tied to the filter's label text; keyboard navigation works through the list
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
