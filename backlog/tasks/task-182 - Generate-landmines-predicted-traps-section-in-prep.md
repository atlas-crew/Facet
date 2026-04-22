---
id: TASK-182
title: Generate landmines (predicted traps) section in prep
status: Done
assignee: []
created_date: '2026-04-19 10:00'
updated_date: '2026-04-22 09:59'
labels:
  - prep
  - prompt-engineering
milestone: m-26
dependencies:
  - TASK-154
references:
  - src/utils/prepGenerator.ts
  - src/types/prep.ts
  - src/routes/prep/PrepLiveMode.tsx
documentation:
  - backlog reference files/General Cheatsheet.html (Landmines section)
  - 'backlog doc-25: Gap 2 Strategic Framing Notes'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The `General Cheatsheet.html` reference has a "Landmines — Have Answers Ready" section: predicted hard questions with tailored answers, specifically framed as traps to avoid. Distinct from open-ended predicted Q&A — these are warning-oriented, pre-loaded escape hatches.

Examples:
- **"Why are you leaving?"** → "Acquisition restructured the team. My role was eliminated. **Never mention manager or politics.** Dates tell the story: Feb 2025 acquisition → Feb 2026 = retention cliff."
- **"You've been mostly solo — can you work on a team?"** → "SOC team mentorship, pro services customer engagements, built tools for other teams. **Solo was context, not preference.**"
- **"No experience with [Go / Java / specific tool]?"** → "Learned Rust from scratch for Synapse — same systems-level thinking. **Frame: 'productive in weeks, not months.'**"

Each landmine has:
1. The trap question
2. The tailored answer (with bold emphasis on the key reframe)
3. An implicit warning about what NOT to do

**Implementation approach (prompt-only, no new type):**

Use the existing `PrepCard` structure with:
- `category: 'behavioral'` or `category: 'situational'`
- `tags: ['landmine']` convention
- `title`: the trap question
- `script` + `scriptLabel: 'The Reframe'`: the tailored answer
- `warning`: what NOT to say ("Never mention manager")
- `notes`: the positioning logic

Update `prepGenerator.ts` system prompt to generate 3-5 landmine cards per deck, tagged `landmine`. The AI should identify common traps based on:
- Application method (inbound vs cold apply has different landmines)
- Career context (acquisition, offshoring, solo work, etc.)
- Stack gaps (skills marked 'conceptual' or 'basic' that the JD requires)
- Round type (HM round has different landmines than technical screen)

**UI:**

In `PrepLiveMode.tsx`, render `tag=landmine` cards as a distinct section ("Landmines — Have Answers Ready") with a red accent, positioned before Behavioral/Technical sections. Uses existing card UI.

**Why this is prompt-only:**
- Reusing `PrepCard` schema keeps the type surface small
- Tag convention (`tag: 'landmine'`) is already idiomatic in the codebase (`tag: 'intel'` set the precedent in TASK-154)
- UI grouping can be derived from tags in `derivePrepCheatsheetSections()`

No schema changes needed. Pure prompt engineering + rendering convention.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 prepGenerator produces 3-5 landmine cards per deck when career context suggests traps
- [x] #2 Landmine cards have tag='landmine', category='behavioral' or 'situational', script with reframe, warning with what NOT to say, notes with positioning logic
- [x] #3 Landmine generation is context-aware: different traps for inbound vs cold, acquisition vs normal exit, etc.
- [x] #4 PrepLiveMode renders tag=landmine cards in a distinct grouped section with red accent
- [x] #5 Existing tag='intel' convention is preserved and continues to work
- [x] #6 No schema changes — reuses PrepCard structure
- [x] #7 Tests verify landmine section appears in live mode when landmine cards exist
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend prep generation to emit/canonicalize 3-5 landmine cards using the existing PrepCard shape and landmine tag.
2. Derive a dedicated Landmines cheatsheet section and render it ahead of the standard live-mode lanes with a red accent treatment.
3. Add focused generator/live-mode regression coverage and verify with prep-targeted tests, typecheck, build, and targeted ESLint.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented on main in commit b2ca643 (feat(prep): add landmine live section).

Verification:
- npx vitest run src/test/prepGenerator.test.ts src/test/PrepLiveMode.test.tsx src/test/prepStore.test.ts src/test/PrepPracticeMode.test.tsx src/test/PrepPage.test.tsx src/test/PrepPage.identityGeneration.test.tsx
- npm run typecheck
- npm run build
- npx eslint src/utils/prepGenerator.ts src/utils/prepCheatsheet.ts src/routes/prep/PrepLiveMode.tsx src/types/prep.ts src/store/prepStore.ts src/test/prepGenerator.test.ts src/test/PrepLiveMode.test.tsx src/test/prepStore.test.ts

Notes:
- landmines reuse PrepCard via tag=landmine; no schema expansion was required for this slice.
- targeted ESLint passed; repo-wide lint still has unrelated baseline/generated-output debt and was treated as non-gating for this prep slice.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added prompt-driven landmine support to the prep workflow without expanding the card schema. The generator now produces and normalizes landmine cards, cheatsheet derivation groups them into a dedicated Landmines section, and PrepLiveMode renders that section with a distinct red-accent treatment ahead of the usual behavioral and technical lanes.

Focused regression coverage was added for generator and live-mode behavior, and the merged main-branch verification passed: prep-targeted Vitest suite, typecheck, build, and targeted ESLint on the touched prep files.
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
