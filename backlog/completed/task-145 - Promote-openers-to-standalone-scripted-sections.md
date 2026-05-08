---
id: TASK-145
title: Promote openers to standalone scripted sections
status: Done
assignee: []
created_date: '2026-04-16 13:14'
updated_date: '2026-04-18 04:34'
labels:
  - prep
  - content
  - rendering
  - generation
milestone: m-18
dependencies:
  - TASK-135
  - TASK-144
references:
  - docs/development/plans/live-cheatsheet-content-v2.md#B2
  - src/utils/prepCheatsheet.ts
  - src/utils/prepGenerator.ts
  - src/routes/prep/PrepLiveMode.tsx
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Promote opener cards from the Core group into their own Openers group with dedicated sections for the 2-3 predictable opening questions every interview has.

**Sections:**
- "Tell me about yourself" — always generated, uses core pitch narrative
- "Why this role/company?" — always generated, pulls from JD + company research
- "Why did you leave X?" — generated when identity model has departure context (from context gap feedback loop, TASK-144)

**Each opener section is a single card rendered as a standalone section**, not a grid. Each has:
- A verbatim script block with scriptLabel ("Say This", ~75 seconds)
- A warning block for pitfalls
- Coaching notes in a blue context block
- Conditionals for "if they push" escalation (from TASK-135)

**Section grouping:**
- New "Openers" group between Intel and Core in the timeline
- Openers group is in the live phase (not pre-interview)

**Generation changes:**
- Request 2-3 opener cards specifically (not just generic 'opener' category cards)
- Pass departure context from identity model when available
- Each opener should have storyBlocks, keyPoints, conditionals, and a time constraint note

**Derivation changes:**
- Opener cards derive as individual sections (one section per opener) in the Openers group
- Each section has its own guidance note

**Identity dependency:**
- "Why did you leave X?" requires departure context. If not available, either:
  - Flag as context gap (TASK-144) 
  - Generate placeholder with `[fill in: your departure reason]`
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Openers group appears between Intel and Core in sidebar and main content
- [x] #2 Tell me about yourself section always generated with scripted answer
- [x] #3 Why this role section always generated from JD and company research
- [x] #4 Why did you leave section generated when departure context available
- [x] #5 Each opener renders as a standalone single-card section
- [x] #6 Openers have script block, warning, coaching notes, and conditionals
- [x] #7 Missing departure context flagged as context gap or placeholder
- [x] #8 Opener sections have per-item budget of ~2 minutes
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Promoted opener cards into dedicated Openers live-mode sections between Intel and Core, with per-opener shortcut handling, standalone rendering, and richer generation/derivation support.

Verification: npx vitest run src/test/prepGenerator.test.ts src/test/prepCheatsheet.test.ts src/test/PrepLiveMode.test.tsx (56 passed); npx eslint src/utils/prepCheatsheet.ts src/routes/prep/PrepLiveMode.tsx src/utils/prepCardContent.ts src/utils/prepGenerator.ts src/test/prepGenerator.test.ts src/test/prepCheatsheet.test.ts src/test/PrepLiveMode.test.tsx; npm run typecheck; npm run build.

Independent review: .agents/reviews/review-20260418-003000-codex-fallback.md found no P0/P1 issues, with one P2 follow-up about brittle opener fallback classification. Independent test audit: .agents/reviews/test-audit-20260418-003100-codex-fallback.md found no P0/P1 gaps, with follow-up coverage suggestions for generic opener fallback and fourth-opener shortcut fallback.
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
