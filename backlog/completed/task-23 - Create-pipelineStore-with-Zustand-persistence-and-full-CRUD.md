---
id: TASK-23
title: Create pipelineStore with Zustand persistence and full CRUD
status: Done
assignee: []
created_date: '2026-03-07 12:00'
updated_date: '2026-03-08 07:36'
labels: []
milestone: m-4
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Define the Pipeline data model and implement a Zustand store with localStorage persistence for managing job search pipeline entries. Also create a lightweight handoff store for passing JD analysis context from Pipeline to Build.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All Pipeline types defined in `src/types/pipeline.ts` per spec (PipelineEntry, PipelineStatus, PipelineTier, ApplicationMethod, etc.)
- [x] #2 `pipelineStore` implemented with Zustand persist middleware, key `facet-pipeline-data`
- [x] #3 CRUD actions: addEntry, updateEntry, deleteEntry, addHistoryNote, setStatus
- [x] #4 Filter/sort state: sortField, sortDir, filters (tier, status, search)
- [x] #5 Import/export: importEntries and exportEntries actions
- [x] #6 `handoffStore` (non-persisted) with setPendingAnalysis and consume actions
- [x] #7 `src/routes/pipeline/samplePipelineData.ts` with 2-3 fictional entries ("Acme Corp", "Initech" etc.) for dev/testing — zero real data
- [x] #8 Legacy migration: check for `localStorage.getItem('pipeline-data')` and offer one-time import on first load
- [x] #9 Empty state design: pipeline starts empty, shows Import JSON + Load Sample Data buttons
- [x] #10 Unit tests for store CRUD, sort, filter, and handoff operations
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create `src/types/pipeline.ts` with all types from spec §3.1.
2. Create `src/store/pipelineStore.ts` using Zustand persist with `resolveStorage()` from existing `src/store/storage.ts`.
3. Create `src/store/handoffStore.ts` as a non-persisted Zustand store per spec §3.5.
4. Create `src/routes/pipeline/samplePipelineData.ts` with 2-3 **fictional** placeholder entries for dev/testing. Do NOT extract real data from pipeline-tracker.html — that contains personal job search data.
5. In pipelineStore init, check for legacy `pipeline-data` localStorage key. If found, surface it for import (not auto-import).
6. Use `createId('pipeline')` from `src/utils/idUtils.ts` for new entry IDs.
7. Write tests in `src/test/pipelineStore.test.ts`.
8. Reference: `docs/PIPELINE_PREP_SPEC.md` §3.1–§3.6.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All acceptance criteria complete. Types, stores (pipeline + handoff), sample data, tests, and empty state were already implemented. Added legacy migration check for `pipeline-data` localStorage key — surfaces an "Import Legacy Data" button on empty state when legacy data is detected.
<!-- SECTION:FINAL_SUMMARY:END -->
