---
id: TASK-9
title: >-
  Implement skills vector routing with per-vector priority, order, and content
  overrides
status: Done
assignee: []
created_date: '2026-02-28 06:14'
updated_date: '2026-02-28 06:23'
labels:
  - feature
  - vector-resume-v0.2
milestone: m-0
dependencies:
  - TASK-8
references:
  - docs/development/plans/active/vector-resume-v0.2-features.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend skill groups to support per-vector inclusion priority, ordering, and optional vector-specific content so skills section output can be tailored by vector in preview and export.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Skill groups support vector-specific priority and exclusion without affecting other vectors.
- [x] #2 Skill groups support vector-specific order and optional content override with default fallback.
- [x] #3 Skill editor UI exposes default + vector-specific content/priority/order controls.
- [x] #4 Live preview updates skill section correctly when switching vectors.
- [x] #5 DOCX export uses vector-specific skill ordering and content.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented skill-group vector routing model with per-vector priority/order/content overrides in assembler and library editing UI.

Added skill-group vector normalization helpers with legacy order migration support.

Updated serializer to validate both legacy order and new vectors format, and normalize skill groups to vector settings on import.

Added assembler and serializer tests for vector-specific skill routing/content and legacy-order upgrade behavior.

Verification: npm run typecheck; npm run test.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented skills vector routing with per-vector priority/order/content behavior across UI, assembly, and import normalization. Skill groups now support vector-specific include/exclude and ordering, optional vector-specific content overrides, and live switching behavior. Serializer accepts both legacy and v0.2 formats and upgrades legacy order maps to vector configs. Added focused assembler/serializer tests with passing verification.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Assembler and serializer tests cover skill routing semantics and round-trip behavior.
- [x] #2 Local verification commands pass for changed code paths.
<!-- DOD:END -->
