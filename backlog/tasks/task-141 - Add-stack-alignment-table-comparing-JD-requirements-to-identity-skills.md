---
id: TASK-141
title: Add stack alignment table comparing JD requirements to identity skills
status: Done
assignee: []
created_date: '2026-04-16 13:13'
updated_date: '2026-04-18 22:24'
labels:
  - prep
  - identity
  - generation
  - content
milestone: m-18
dependencies:
  - TASK-138
references:
  - docs/development/plans/live-cheatsheet-content-v2.md#B7
  - src/identity/schema.ts
  - src/utils/prepGenerator.ts
  - src/utils/prepCheatsheet.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Generate a "Their Stack | Your Match | Confidence" comparison table by analyzing JD tech requirements against the identity model's skill enrichment data.

**Data source:**
- JD tech requirements: extracted by AI from the job description
- Candidate skills: from `ProfessionalIdentityV3.skill_groups[].skills[]` with `depth` (expert/strong/working/basic) and `positioning`

**Generation changes:**
- Add `stackAlignment` to generation response: `Array<{ theirTech: string; yourMatch: string; confidence: string }>`
- AI compares JD requirements against identity skills, produces honest alignment
- Confidence levels: "Strong", "Solid", "Working knowledge", "Adjacent experience", "Gap"
- Store on PrepDeck as `stackAlignment`

**Derivation:**
- Add stack alignment as a sub-section within Numbers to Know, or as a standalone section in Tactical group
- Render as a standard HTML table

**Rendering:**
- Three-column table with header row
- Confidence column color-coded: green (Strong/Solid), amber (Working/Adjacent), red (Gap)

**This is the foundation for gap framing (TASK next) — if the alignment table shows "Gap" entries, those become candidates for gap-framing cards.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 stackAlignment type added to PrepDeck
- [x] #2 Generation produces stack alignment from JD vs identity skills
- [x] #3 Confidence levels are honest (includes gaps, not just strengths)
- [x] #4 Table renders in live cheatsheet with color-coded confidence
- [x] #5 Works gracefully when identity has no skills (table omitted)
- [x] #6 Alignment data available for downstream gap framing
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Extend PrepDeck typing and store normalization so stackAlignment is a persisted deck field that survives imports, exports, and migration windows.
Update prep generation to request stackAlignment rows from JD requirements versus identity skill enrichment, normalize the allowed confidence levels, and omit the table when identity skills are unavailable.
Thread stackAlignment through cheatsheet derivation and live rendering as a styled three-column table so downstream gap-framing work can reuse the same data.
Add focused prep generator, store, cheatsheet, and live-mode tests, then run eslint, typecheck, and build before closing the task.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added deck-level `stackAlignment` support across prep typing, store/import sanitization, AI generation normalization, cheatsheet derivation, and live-mode rendering with confidence-coded pills for `Strong`, `Solid`, `Working knowledge`, `Adjacent experience`, and `Gap`.

Verification:
- `npx vitest run src/test/prepGenerator.test.ts src/test/prepStore.test.ts src/test/prepCheatsheet.test.ts src/test/PrepLiveMode.test.tsx src/test/PrepPage.identityGeneration.test.tsx` (`78` passed)
- `npx eslint src/types/prep.ts src/store/prepStore.ts src/utils/prepGenerator.ts src/utils/prepCheatsheet.ts src/utils/prepImport.ts src/routes/prep/PrepPage.tsx src/routes/prep/PrepLiveMode.tsx src/test/prepGenerator.test.ts src/test/prepStore.test.ts src/test/prepCheatsheet.test.ts src/test/PrepLiveMode.test.tsx src/test/PrepPage.identityGeneration.test.tsx`
- `npm run typecheck`
- `npm run build`

Independent review:
- Code review: `.agents/reviews/review-20260418-221940.md` (`PASS WITH ISSUES`, no `P0`/`P1`)
- Full-slice test audit exceeded the script size guard, so the audit was split into smaller units.
- Generator audit: `.agents/reviews/test-audit-20260418-222234.md`
<!-- SECTION:FINAL_SUMMARY:END -->
