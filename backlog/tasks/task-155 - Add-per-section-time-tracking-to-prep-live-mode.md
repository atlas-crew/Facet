---
id: TASK-155
title: Add per-section time tracking to prep live mode
status: To Do
assignee: []
created_date: '2026-04-19 06:03'
labels:
  - prep
  - live-mode
milestone: m-26
dependencies: []
references:
  - src/routes/prep/PrepLiveMode.tsx
  - src/utils/prepGenerator.ts
documentation:
  - 'backlog doc-25: Gap 5 Per-Section Time Budgets'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The prep live cheatsheet has a global timer but no per-section time tracking. The reference prep documents show time budgets per section in the sidebar nav with over-budget/near-budget coloring.

1. **Time budget on sections** — Add `timeBudgetMinutes?: number` to the cheatsheet section derivation (in the section model used by `derivePrepCheatsheetSections()` or equivalent). The AI should generate suggested time budgets during prep generation (e.g., opener: 2min, behavioral: 3min, technical: 5min).

2. **Track time-in-section** — In `PrepLiveMode.tsx`, track which section is active (scrolled into view or navigated to via j/k/number keys). Accumulate elapsed time per section.

3. **Display in sidebar nav** — Show `elapsed / budget` next to each section link in the sidebar. Color-code: green (under budget), amber (within 30s of budget), red (over budget).

4. **Budget in generation** — Update `prepGenerator.ts` to include `timeBudgetMinutes` in the section/card output schema. AI suggests budgets based on card complexity and interview duration.

Reference: doc-25, Gap 5. The `generic-prep.html` reference shows `data-budget` attributes and `nav-time` elements with `over-budget`/`near-budget` CSS classes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each cheatsheet section has an optional timeBudgetMinutes value
- [ ] #2 PrepLiveMode tracks elapsed time per section based on which section is active
- [ ] #3 Sidebar nav shows elapsed/budget next to each section link
- [ ] #4 Near-budget (amber) and over-budget (red) color states display correctly
- [ ] #5 AI generation suggests time budgets per section based on content and interview duration
- [ ] #6 Global timer continues to work alongside per-section tracking
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
