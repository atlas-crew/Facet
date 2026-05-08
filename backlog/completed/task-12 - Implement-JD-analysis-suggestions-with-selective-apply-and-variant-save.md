---
id: TASK-12
title: Implement JD analysis suggestions with selective apply and variant save
status: Done
assignee: []
created_date: '2026-02-28 06:15'
updated_date: '2026-02-28 06:32'
labels:
  - feature
  - vector-resume-v0.2
  - ai
milestone: m-0
dependencies:
  - TASK-11
references:
  - docs/development/plans/active/vector-resume-v0.2-features.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add Analyze JD workflow that accepts pasted job descriptions, requests structured recommendations, supports graceful no-key behavior, allows selective apply, and can save accepted recommendations as a variant.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Users can paste a JD and trigger analysis from the UI.
- [x] #2 App handles missing API key and API errors gracefully without crashing.
- [x] #3 Results render as toggleable suggestions (vector recommendation, bullet adjustments, skill gaps, positioning note).
- [x] #4 Users can selectively apply suggestions to current state.
- [x] #5 Applied suggestions can be saved as a named variant.
- [x] #6 Skill gap analysis highlights missing skills from JD.
- [x] #7 JD under 50 words warns; very long JD is truncated with visible note.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added JD analysis utility (`src/utils/jdAnalyzer.ts`) with JD length preparation/truncation, structured response parsing, and Anthropic API integration against model claude-sonnet-4-20250514.

Implemented Analyze JD modal in App with paste area, missing-key graceful messaging, short-JD warning (<50 words), long-JD truncation notice, and API error handling.

Rendered reviewable/toggleable recommendation sections (vector recommendation, bullet adjustments, target line, skill gaps, positioning note).

Implemented selective apply flow for accepted suggestions and Apply & Save as Variant action integrated with saved-variant persistence.

Added deterministic tests for JD preparation/parser behavior (`src/test/jdAnalyzer.test.ts`).

Verification: npm run typecheck; npm run test.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented JD paste analysis workflow with graceful API-key handling, structured recommendation parsing, and interactive review/apply UX. Users can analyze pasted JDs, selectively apply vector/target-line/bullet suggestions, inspect skill gaps and positioning note, and immediately save accepted state as a named variant. Added deterministic utility tests for truncation and JSON parsing behavior with full local verification passing.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Analysis parsing/apply logic has deterministic tests for success/error/missing-key paths.
- [x] #2 Local verification commands pass for changed code paths.
<!-- DOD:END -->
