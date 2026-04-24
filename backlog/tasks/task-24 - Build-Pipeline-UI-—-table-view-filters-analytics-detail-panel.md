---
id: TASK-24
title: 'Build Pipeline UI — table view, filters, analytics, detail panel'
status: Done
assignee: []
created_date: '2026-03-07 12:00'
updated_date: '2026-03-08 07:36'
labels: []
milestone: m-4
dependencies:
  - TASK-23
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the full Pipeline route UI as a React implementation of the existing vanilla HTML pipeline tracker, redesigned to match Facet's design system. Includes sortable table, filter pills, analytics panel, entry modal, and detail expansion.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `PipelinePage` renders at `/pipeline` with stats strip, filters, and table
- [x] #2 `PipelineTable` with sortable columns: Company, Role, Tier, Status, Comp, Last Action, Next Step
- [x] #3 Rows expand to show `PipelineDetail` with all fields, history timeline, and action buttons
- [x] #4 `PipelineFilters` — tier and status filter pills, text search input
- [x] #5 `PipelineStats` funnel strip: Targets → Applied → Responded → Interviewing → Offers
- [x] #6 `PipelineAnalytics` toggleable panel with: response rate, avg days, by-vector, by-method, by-resume-variant, rejection stages, interview formats, skill frequency
- [x] #7 `PipelineEntryModal` for add/edit with all PipelineEntry fields grouped logically
- [x] #8 Inline status quick-change dropdown on table rows
- [x] #9 Import/export JSON buttons
- [x] #10 All styles use CSS custom properties from the existing design system, in `src/routes/pipeline/pipeline.css`
- [x] #11 Responsive: reasonable mobile layout
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create all components in `src/routes/pipeline/` per spec §3.3.
2. PipelinePage layout: vertical stack — PipelineStats at top, PipelineFilters below, PipelineTable as main body, PipelineAnalytics as toggleable section.
3. PipelineTable: use pipelineStore selectors for filtered/sorted entries. Map through entries to render rows. Click row to expand. Each row gets a status badge that's also a dropdown trigger.
4. PipelineDetail: render inside expanded row. Show: positioning, skillMatch, notes, contact, history timeline (newest first), and buttons for Edit / Delete / Open Link / Analyze in Builder.
5. PipelineAnalytics: port all 8 analytics computations from pipeline-tracker.html lines 1241-1415. All as useMemo derived from pipelineStore entries. Use the funnel, KPI cards, and breakdown table patterns.
6. PipelineEntryModal: group fields into sections — Core (company, role, tier, status, comp, url), Facet (vector, resumeVariant), Positioning (positioning, skillMatch, nextStep, notes), Tracking (appMethod, response, daysToResponse, rounds, format, rejectionStage, rejectionReason, offerAmount, dateApplied, dateClosed).
7. CSS: create pipeline.css imported by PipelinePage. Use var(--bg-surface), var(--border-subtle), var(--font-mono) etc. Match the visual density of the build view.
8. **Visual targets:** `docs/assets/mockups/pipeline-table.png` and `docs/assets/mockups/pipeline-analytics.png`. Match this layout, density, and visual language. Reference `docs/assets/mockups/reference-dense-form.png` for entry modal form density.
9. Reference: `docs/PIPELINE_PREP_SPEC.md` §3 (mockups) + §4.3–§4.4, source HTML lines 543-1415.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All acceptance criteria complete. Most UI was already built. Added: (1) inline status quick-change dropdown on table rows via native select styled as badge, (2) by-vector and by-resume-variant analytics breakdowns in PipelineAnalytics, (3) vectorId field in PipelineEntryModal for linking entries to Facet vectors.
<!-- SECTION:FINAL_SUMMARY:END -->
