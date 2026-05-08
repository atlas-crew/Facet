---
id: TASK-127
title: Add rich content fields to PrepCard and PrepDeck types
status: Done
assignee:
  - codex
created_date: '2026-04-16 09:45'
updated_date: '2026-04-16 10:08'
labels:
  - prep
  - types
  - foundation
milestone: m-17
dependencies: []
references:
  - docs/development/plans/live-cheatsheet-content-v2.md
  - src/types/prep.ts
  - src/store/prepStore.ts
  - src/types/pipeline.ts
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add new type definitions and fields to support rich cheatsheet content.

**PrepCard additions:**
- `storyBlocks?: PrepStoryBlock[]` — structured Problem/Solution/Result/Closer narrative
- `keyPoints?: string[]` — glance points (3-5 scannable bullets)
- `scriptLabel?: string` — contextual label for script blocks ("Say This", "The Pitch")

**New type:**
```typescript
interface PrepStoryBlock {
  label: 'problem' | 'solution' | 'result' | 'closer' | 'note'
  text: string
}
```

**PrepDeck additions:**
- `roundType?: InterviewFormat` — reuse pipeline's InterviewFormat union
- `donts?: string[]` — personalized anti-patterns (deck-level, not card-level)
- `questionsToAsk?: Array<{ question: string; context: string }>` — with coaching context
- `categoryGuidance?: Record<string, string>` — per-category section guidance

**PrepFollowUp addition:**
- `context?: string` — "why this question matters" coaching note

**PrepCheatsheetSection additions:**
- `guidance?: string` — section-level coaching note
- `group?: string` — group label for sidebar grouping

Update `sanitizeCard` and `sanitizeDeck` in prepStore to validate all new fields.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All new fields added to types/prep.ts
- [x] #2 PrepStoryBlock type defined with label union
- [x] #3 roundType uses InterviewFormat from pipeline types
- [x] #4 sanitizeCard validates storyBlocks (label enum + text string), keyPoints (string[]), scriptLabel (string)
- [x] #5 sanitizeDeck validates roundType, donts, questionsToAsk, categoryGuidance
- [x] #6 Existing cards/decks without new fields continue to work (all fields optional)
- [x] #7 TypeScript compiles cleanly
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Owner: main rollout (codex).
Scope: update src/types/prep.ts and src/store/prepStore.ts for rich cheatsheet fields plus sanitization coverage.
Validation: targeted prep store/type tests, then typecheck for the touched slice.
Handoff: once foundation fields compile and sanitize cleanly, unblock TASK-128/TASK-129 and notify worker lanes that the data contract is stable.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented rich prep schema foundation across src/types/prep.ts, src/types/pipeline.ts, and src/store/prepStore.ts.

Hardened sanitization for new rich fields plus malformed followUps/deepDives/metrics on migration/import/update paths to prevent startup crashes from dirty persisted data.

Verification: npx vitest run src/test/prepStore.test.ts (11 passed), npm run typecheck (passed), npm run build (passed).

Independent review: no findings after remediation; residual risk is manual whitelist arrays must stay aligned with union types.

Repo-wide npm run lint still fails from unrelated baseline debt in generated .vercel/dist assets plus pre-existing identity/hosted test files; not caused by this slice.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the rich cheatsheet foundation types and store sanitization, including roundType, storyBlocks, keyPoints, donts, questionsToAsk, categoryGuidance, and follow-up context. Hardened import/migration/update paths against malformed persisted data, added focused prepStore coverage for create/import/update/replace flows, and verified with prepStore tests, typecheck, and build.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
