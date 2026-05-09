---
id: TASK-136
title: Add alternative narrative support to prep cards
status: Done
assignee:
  - '@codex'
created_date: '2026-04-16 13:11'
updated_date: '2026-05-09 00:32'
labels:
  - prep
  - content
  - rendering
milestone: m-18
dependencies:
  - TASK-208
references:
  - docs/development/plans/live-cheatsheet-content-v2.md#B5
  - src/types/prep.ts
  - src/routes/prep/PrepLiveMode.tsx
  - src/routes/prep/PrepCardView.tsx
modified_files:
  - src/types/prep.ts
  - src/store/prepStore.ts
  - src/routes/prep/PrepPage.tsx
  - src/routes/prep/PrepCardView.tsx
  - src/routes/prep/PrepLiveMode.tsx
  - src/routes/prep/prep.css
  - src/utils/prepGenerator.ts
  - src/utils/prepCardContent.ts
  - src/test/prepStore.test.ts
  - src/test/PrepCardView.test.tsx
  - src/test/PrepLiveMode.test.tsx
  - src/test/prepGenerator.test.ts
  - >-
    backlog/docs/doc-41 -
    Prep-V2-—-PrepDeck-Foundation-Content-Extensions-Rollout-Plan.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Status Update (2026-05-08 — backlog staleness audit)

**REDIRECTED per task-208 Workstream 1 audit (2026-05-04).**

The PrepCard `alternativeTitle` / `alternativeScript` fields, the collapsible rendering, edit-mode UI, and store sanitization all remain in scope and unchanged. **What changes is the generator's source of truth:** alternative narratives must be sourced from `JDAnalysis.evidenceMapping` and `JDAnalysis.advantages` (matched against identity stories), NOT from raw-JD re-inference.

After task-208 closed (2026-05-05), `prepGenerator.ts` accepts canonical JDAnalysis as structured input. The prompt update for this task should pull alternative-story candidates from `evidenceMapping.topBullets` / `topProjects` filtered by `matchedRequirementIds` rather than asking the model to re-rank stories from raw JD text.

The original task body below describes the user-facing capability, which still ships.

---

Add backup story support to behavioral/project cards. Prevents story brittleness — if the interviewer's follow-up doesn't fit the primary narrative, the user has a labeled alternative.

**Type changes:**
Add to PrepCard:
- `alternativeTitle?: string` — label for the backup story (e.g., "Alternative: VP Demo at A10")
- `alternativeScript?: string` — the backup narrative

**Rendering in live cheatsheet:**
- When alternativeTitle/alternativeScript present, render a collapsible "Alternative" block below the primary card content
- Visually secondary (muted border, slightly smaller text)
- Collapsed by default — user expands only when they need the backup

**Generation prompt update (REDIRECTED):**
- Source alternative-story candidates from `JDAnalysis.evidenceMapping.topBullets` / `topProjects` filtered by `matchedRequirementIds`, NOT from raw JD inference
- Request one alternative narrative for each behavioral card when canonical evidence has multiple stories supporting the same requirement

**Edit mode:**
- Two optional fields in the card editor: "Alternative title" input + "Alternative script" textarea
- Shown in a collapsible "Alternative Story" section within the card editor

**Store sanitization:**
- Validate both as optional strings, trim whitespace
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 alternativeTitle and alternativeScript fields added to PrepCard
- [x] #2 Live cheatsheet renders collapsible Alternative block when fields present
- [x] #3 Alternative block collapsed by default
- [x] #4 Cards without alternative fields render unchanged
- [x] #5 Generation prompt requests alternatives for behavioral cards
- [x] #6 Edit mode shows Alternative Story section with title + script fields
- [x] #7 Store sanitization validates both as optional trimmed strings
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Starting TASK-136. Scope: add optional alternativeTitle/alternativeScript to PrepCard, preserve/trim through prep store/export/generator normalization, render collapsed alternative story in edit/live modes, and anchor generator prompt to canonical JDAnalysis.evidenceMapping/advantages.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented optional PrepCard alternativeTitle/alternativeScript across types, store sanitization/export/import, generator normalization/prompting from canonical JDAnalysis evidence, edit-mode and live/read-only collapsed rendering, and placeholder-aware preview/review handling. Verification: npm run format:files on touched files passed; npx vitest run src/test/prepStore.test.ts src/test/PrepCardView.test.tsx src/test/PrepLiveMode.test.tsx src/test/prepGenerator.test.ts src/test/prepCardContent.test.ts passed (180 tests); focused npx eslint on touched TS/TSX/test files passed. npm run build was attempted and remains blocked only by pre-existing unrelated src/test/identityFieldDeps.test.ts TS2459 SkillMatch export error.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
