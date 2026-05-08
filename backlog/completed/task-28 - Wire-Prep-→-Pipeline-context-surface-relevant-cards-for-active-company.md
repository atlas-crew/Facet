---
id: TASK-28
title: Wire Prep → Pipeline context (surface relevant cards for active company)
status: Done
assignee: []
created_date: '2026-03-07 12:00'
updated_date: '2026-03-08 09:16'
labels: []
milestone: m-4
dependencies:
  - TASK-24
  - TASK-27
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Connect Pipeline entries to the Prep view so users can jump to contextually filtered interview prep cards when preparing for a specific company's interview.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 "Prep for Interview" button on pipeline entries in interviewing/screening status
- [x] #2 Button navigates to `/prep?vector=X&skills=Y` using entry's vectorId and skillMatch
- [x] #3 PrepPage reads search params via TanStack Router validateSearch
- [x] #4 Cards auto-filter by matching tags against vector + skills params
- [x] #5 Active filter state shown in PrepSearch with clear button to show all cards
- [x] #6 Update `router.tsx` prep route with search param validation
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add validateSearch to prep route in router.tsx per spec §4.4.
2. In PipelineDetail, add "Prep for Interview" button. Build search params from entry.vectorId and entry.skillMatch (split by comma, join with comma).
3. In PrepPage, read search params. If vector or skills are set, pre-filter cards by matching tags. Skills comparison: split skills param by comma, check if any card tag includes the skill (case-insensitive substring match).
4. Show a "Filtered for: [company]" banner in PrepSearch when params are active, with a "Show All" button that clears params via router navigation.
5. Reference: `docs/PIPELINE_PREP_SPEC.md` §4.4.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
"Prep for Interview" button on screening/interviewing entries navigates to `/prep?vector=X&skills=Y`. PrepPage reads search params via TanStack Router `useSearch`. Cards auto-filter by tags matching vector/skills params. Vector chip with clear button in PrepSearch. Router `validateSearch` on prep route validates search params.
<!-- SECTION:FINAL_SUMMARY:END -->
