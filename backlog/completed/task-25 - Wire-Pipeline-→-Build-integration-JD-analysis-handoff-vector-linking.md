---
id: TASK-25
title: 'Wire Pipeline → Build integration (JD analysis handoff, vector linking)'
status: Done
assignee: []
created_date: '2026-03-07 12:00'
updated_date: '2026-03-08 07:36'
labels: []
milestone: m-4
dependencies:
  - TASK-23
  - TASK-24
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the bidirectional data flow between Pipeline and Build routes. Pipeline entries with JD text can launch into Facet's JD analyzer with one click. After analysis and preset creation, the preset ID flows back to the pipeline entry.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 "Analyze in Builder" button appears on pipeline entries that have jobDescription text
- [x] #2 Clicking it writes to handoffStore and navigates to `/build`
- [x] #3 BuildPage reads handoffStore on mount — if pending, auto-opens JD modal with text pre-filled
- [x] #4 After handoff consumption, handoffStore is cleared
- [x] #5 "Open in Builder" button on entries with a vectorId — navigates to `/build` and selects that vector
- [x] #6 After saving a preset in build view (when sourceEntryId is set), presetId is written back to the pipeline entry
- [x] #7 Pipeline entry shows linked preset name when presetId is set
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. In PipelineDetail, add "Analyze in Builder" button. onClick: `handoffStore.setPendingAnalysis(entry.jobDescription, entry.vectorId, entry.id)` then `router.navigate({ to: '/build' })`.
2. In PipelineDetail, add "Open in Builder" button (only if vectorId set). onClick: navigate to `/build` and call `uiStore.setSelectedVector(entry.vectorId)`.
3. In BuildPage, add a useEffect that on mount checks `handoffStore.consume()`. If non-null, set jdInput to the JD text, open the JD modal, and if vectorId is provided, switch to that vector.
4. In BuildPage's preset save flow (usePresets hook or onSavePreset), check if handoffStore has a sourceEntryId. If so, call `pipelineStore.updateEntry(entryId, { presetId: newPreset.id })`.
5. In PipelineTable/PipelineDetail, show preset name by looking up presetId in resumeStore data.presets.
6. Reference: `docs/PIPELINE_PREP_SPEC.md` §3.5.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All acceptance criteria complete. Added: (1) vectorId pre-selection on BuildPage handoff consume, (2) "Open in Builder" button in PipelineDetail for entries with vectorId, (3) preset writeback via onPresetSaved callback in usePresets — writes presetId back to pipeline entry when sourceEntryId is set from handoff, (4) linked preset name display in PipelineDetail.
<!-- SECTION:FINAL_SUMMARY:END -->
