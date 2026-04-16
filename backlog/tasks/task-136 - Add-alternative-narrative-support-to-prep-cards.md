---
id: TASK-136
title: Add alternative narrative support to prep cards
status: To Do
assignee: []
created_date: '2026-04-16 13:11'
labels:
  - prep
  - content
  - rendering
milestone: m-18
dependencies: []
references:
  - docs/development/plans/live-cheatsheet-content-v2.md#B5
  - src/types/prep.ts
  - src/routes/prep/PrepLiveMode.tsx
  - src/routes/prep/PrepCardView.tsx
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add backup story support to behavioral/project cards. Prevents story brittleness — if the interviewer's follow-up doesn't fit the primary narrative, the user has a labeled alternative.

**Type changes:**
Add to PrepCard:
- `alternativeTitle?: string` — label for the backup story (e.g., "Alternative: VP Demo at A10")
- `alternativeScript?: string` — the backup narrative

**Rendering in live cheatsheet:**
- When alternativeTitle/alternativeScript present, render a collapsible "Alternative" block below the primary card content
- Visually secondary (muted border, slightly smaller text)
- Collapsed by default — user expands only when they need the backup

**Generation prompt update:**
- Request one alternative narrative for each behavioral card when the candidate has multiple relevant stories for the same theme

**Edit mode:**
- Two optional fields in the card editor: "Alternative title" input + "Alternative script" textarea
- Shown in a collapsible "Alternative Story" section within the card editor

**Store sanitization:**
- Validate both as optional strings, trim whitespace
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 alternativeTitle and alternativeScript fields added to PrepCard
- [ ] #2 Live cheatsheet renders collapsible Alternative block when fields present
- [ ] #3 Alternative block collapsed by default
- [ ] #4 Cards without alternative fields render unchanged
- [ ] #5 Generation prompt requests alternatives for behavioral cards
- [ ] #6 Edit mode shows Alternative Story section with title + script fields
- [ ] #7 Store sanitization validates both as optional trimmed strings
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
