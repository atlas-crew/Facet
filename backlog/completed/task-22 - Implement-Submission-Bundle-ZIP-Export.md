---
id: TASK-22
title: Implement 'Submission Bundle' ZIP Export
status: Done
assignee: []
created_date: '2026-03-01 04:08'
updated_date: '2026-03-08 09:52'
labels: []
milestone: m-3
dependencies: []
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Provide a one-click action to export a package containing the PDF, a plain-text version (for ATS), and the JSON source.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 'Download Bundle' action generates a .zip file.
- [x] #2 ZIP contains {Vector}_Resume.pdf, {Vector}_ATS.txt, and Resume_Source.json.
- [x] #3 File naming follows project conventions.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Install 'jszip'.
2. Create 'src/utils/bundleExporter.ts'.
3. Implement logic to gather: current PDF blob, plain-text output (from 'textRenderer.ts'), and the JSON state.
4. Generate filenames based on '{Name}_Resume_{Vector}_{Date}'.
5. Implement the '.zip' generation and trigger a browser download.
6. Add a 'Download Bundle' button to the 'TopBar' export menu.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented submission bundle ZIP export via `jszip`. Added `src/utils/bundleExporter.ts` with `buildBundle()` that packages PDF blob, ATS plain text, and JSON source into a ZIP. Added "Download Bundle" menu item to the File dropdown in BuildPage. Files in the ZIP follow the naming convention `{FirstLast}_Resume_{Vector}.pdf`, `_ATS.txt`, `_Source.json`.
<!-- SECTION:FINAL_SUMMARY:END -->
