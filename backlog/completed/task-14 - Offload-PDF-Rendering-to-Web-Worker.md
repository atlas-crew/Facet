---
id: TASK-14
title: Offload PDF Rendering to Web Worker
status: Done
assignee: []
created_date: '2026-03-01 04:08'
updated_date: '2026-03-06 19:42'
labels: []
milestone: m-1
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Move the Typst WASM rendering logic into a Web Worker to ensure the main UI thread remains responsive during PDF generation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 typstRenderer.ts logic runs in a separate worker thread.
- [x] #2 Main thread UI (typing, scrolling) does not freeze during rendering.
- [x] #3 usePdfPreview hook handles asynchronous communication with the worker.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create 'src/engine/typst.worker.ts' to host the Typst WASM instance.
2. Define a messaging protocol (request/response) for 'render' commands.
3. Update 'typstRenderer.ts' to support both direct and worker-based calls.
4. Modify 'usePdfPreview.ts' to instantiate the worker on mount.
5. Implement a debounce/cancellation mechanism in the worker to handle rapid state updates.
6. Update the 'PdfPreview' loading state to reflect worker activity.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Offloaded PDF rendering to a background Web Worker to ensure the main UI thread remains responsive.

Key changes:
- Created/Renamed `src/engine/typst.worker.ts` to host the Typst WASM instance and handle rendering logic in a background thread.
- Updated `src/utils/typstRenderer.ts` to support both direct and worker-based calls. The `renderResumeAsPdf` function now defaults to worker-based rendering, which is preferred for UI-blocking operations like density optimization.
- Refactored `src/hooks/usePdfPreview.ts` to use the persistent Web Worker for live previews, including a debounce and generation-tracking mechanism to handle rapid state updates and ignore stale results.
- Offloaded the density optimizer binary search iterations to the worker via the updated `renderResumeAsPdf` utility.
- Ensured graceful fallback to direct rendering in environments where Web Workers are unavailable.
- Verified that PDF downloads and previews continue to function correctly with the offloaded architecture.
- All tests passing.
<!-- SECTION:FINAL_SUMMARY:END -->
