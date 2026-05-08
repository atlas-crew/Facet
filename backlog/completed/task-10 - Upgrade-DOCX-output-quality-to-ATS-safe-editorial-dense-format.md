---
id: TASK-10
title: Upgrade DOCX output quality to ATS-safe editorial dense format
status: Done
assignee: []
created_date: '2026-02-28 06:14'
updated_date: '2026-02-28 06:25'
labels:
  - feature
  - vector-resume-v0.2
milestone: m-0
dependencies:
  - TASK-9
references:
  - docs/development/plans/active/vector-resume-v0.2-features.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bring DOCX rendering to v0.2 production quality with ATS-safe structure, typography/spacing constraints, character sanitization, page budget signaling, and vector-aware filename format.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 DOCX structure avoids tables/columns/text boxes and remains copy-paste parseable.
- [x] #2 Typography and spacing follow editorial dense settings (Aptos body/name sizing and section heading style).
- [x] #3 Character sanitization removes disallowed hidden characters and normalizes special punctuation.
- [x] #4 Status bar warns at >=1.8 pages and critical at >=2 pages.
- [x] #5 DOCX download filename follows {FirstName}{LastName}_Resume_{vectorLabel}.docx.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Upgraded editorial dense DOCX template to Aptos typography, heading styles, tighter margins/spacing, keep-next section headers, and right-aligned role date formatting.

Added DOCX text sanitization utility for hidden characters, smart quotes normalization, and µ symbol replacement.

Added vector-aware DOCX filename utility and integrated App download naming to {FirstName}{LastName}_Resume_{vectorLabel}.docx format.

Updated page budget estimate to fractional pages and surfaced near-limit (>=1.8) vs over-limit (>=2) status messaging in StatusBar.

Added tests for sanitization and filename behavior in src/test/docxFormatting.test.ts; verification: npm run typecheck; npm run test.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delivered DOCX quality upgrades for editorial dense output: Aptos typography, heading styles, ATS-safe paragraph structure, section keep-next behavior, tighter margins, and right-aligned role dates. Added sanitization for hidden/unwanted characters and vector-aware filename generation. Updated page-budget display to warn at >=1.8 pages and mark critical at >=2 pages. Added tests for sanitization/filename utilities with passing verification.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 DOCX/template and page-budget tests cover formatting/sanitization/filename behavior.
- [x] #2 Local verification commands pass for changed code paths.
<!-- DOD:END -->
