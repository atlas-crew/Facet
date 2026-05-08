---
id: TASK-27
title: Build Prep UI — searchable card grid with category/vector filtering
status: Done
assignee: []
created_date: '2026-03-07 12:00'
updated_date: '2026-03-08 09:16'
labels: []
milestone: m-4
dependencies:
  - TASK-26
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the Interview Prep route UI as a searchable, filterable grid of reference cards. Each card displays the question/topic with expandable content blocks (scripts, follow-ups, deep dives, metrics). Uses Facet's existing design system.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `PrepPage` renders at `/prep` with search bar, category tabs, and card grid
- [x] #2 `PrepSearch` — text search filters cards by title, script, and followUp content. Category pills filter by PrepCategory.
- [x] #3 `PrepCardGrid` — responsive grid layout (2-3 columns desktop, 1 column mobile)
- [x] #4 `PrepCardView` renders each card with: category badge, title, script block (with copy-to-clipboard button), warning block (if present), collapsible follow-up Q&A pairs, collapsible deep-dive accordions, metric badge strip, tables
- [x] #5 Search is instant (client-side filter, no debounce needed for ~30 cards)
- [x] #6 Category pills show count of matching cards
- [x] #7 All styles in `src/routes/prep/prep.css` using CSS custom properties
- [x] #8 Empty state when no cards match filter
- [x] #9 Empty state when no data imported: Import JSON + Load Sample Data buttons (mirrors build route's empty state pattern)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create components in `src/routes/prep/` per spec §4.3.
2. PrepPage layout: PrepSearch at top (sticky), PrepCardGrid below as scrollable body.
3. PrepSearch: text input + row of category filter pills (All, Opener, Behavioral, Technical, Project, Metrics, Situational) per mockup. Active pill highlights with accent color. Text search filters across title + script + followUp questions/answers.
4. PrepCardGrid: CSS grid, `grid-template-columns: repeat(auto-fill, minmax(400px, 1fr))`.
5. PrepCardView: component-card-like styling from existing CSS. Script blocks get a monospace-ish treatment with a small copy button. Follow-ups render as Q/A pairs (question bold, answer below). Deep dives use HTML `<details>` or a React accordion. Metrics render as a horizontal strip of small badge-like elements.
6. Copy-to-clipboard on script blocks: `navigator.clipboard.writeText()`.
7. CSS: prep.css imported by PrepPage. Card styling should feel like a reference document — slightly more reading-friendly than the dense build UI.
8. Empty state: when prepStore has no cards, show a centered empty state with Import JSON and Load Sample Data buttons. Sample data loads from samplePrepData.ts (fictional only).
9. **Visual targets:** `docs/assets/mockups/prep-cards-openers.png` and `docs/assets/mockups/prep-cards-technical.png`. Match this card layout, content block styling, and visual density.
10. Reference: `docs/PIPELINE_PREP_SPEC.md` §3 (mockups) + §5.1–§5.3.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Full prep UI: PrepPage at `/prep` with search, category pills (with card counts), and responsive card grid. Text search covers title, tags, script, and followUp content. PrepCardView renders all block types with copy-to-clipboard. Category pills show matching card counts. All styles in `prep.css` using CSS custom properties. Both empty states implemented (no data, no filter matches).
<!-- SECTION:FINAL_SUMMARY:END -->
