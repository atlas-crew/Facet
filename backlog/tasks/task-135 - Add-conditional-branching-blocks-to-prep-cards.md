---
id: TASK-135
title: Add conditional branching blocks to prep cards
status: Done
assignee: []
created_date: '2026-04-16 13:11'
updated_date: '2026-04-17 09:56'
labels:
  - prep
  - content
  - rendering
  - generation
milestone: m-18
dependencies: []
references:
  - docs/development/plans/live-cheatsheet-content-v2.md#B1
  - src/types/prep.ts
  - src/routes/prep/PrepLiveMode.tsx
  - src/routes/prep/PrepCardView.tsx
  - src/utils/prepGenerator.ts
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add "if they push on X, pivot to Y" coaching blocks embedded within cards. This is the highest-value content pattern still missing — every reference document uses it extensively.

**Type changes:**
```typescript
interface PrepConditional {
  trigger: string   // "If they ask about...", "If they push on..."
  response: string  // What to say or do
  tone?: 'pivot' | 'trap' | 'escalation'
}
```
Add `conditionals?: PrepConditional[]` to PrepCard.

**Rendering in live cheatsheet:**
- Conditionals render below the main card content as indented blocks
- Trigger text styled as a label ("If they push:")
- Response text as the body
- `trap` tone renders as a paired Trap (red) / Reframe (green) card pattern from the R1 reference
- `escalation` tone renders with amber warning styling

**Generation prompt update:**
- Request conditionals for opener cards (departure questions), behavioral cards (follow-up pressure), and gap-framing cards
- Request trap/reframe pairs for common gotcha questions

**Edit mode:**
- Conditionals editor in PrepCardView: list of trigger/response/tone entries with add/remove
- Tone selector dropdown (pivot/trap/escalation)

**Store sanitization:**
- Validate conditionals array: each entry needs trigger (string) and response (string), tone optional with enum check
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 PrepConditional type defined with trigger, response, and optional tone
- [ ] #2 conditionals field added to PrepCard
- [ ] #3 Live cheatsheet renders conditionals below card content
- [ ] #4 trap-toned conditionals render as Trap/Reframe paired blocks
- [ ] #5 Generation prompt requests conditionals for openers and behavioral cards
- [ ] #6 Edit mode has conditionals list editor with tone selector
- [ ] #7 Store sanitization validates conditionals array
- [ ] #8 Cards without conditionals render unchanged
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added PrepConditional typing plus store and generator normalization for pivot, trap, and escalation coaching blocks.

Rendered conditionals in read-only and live prep surfaces, including trap/reframe pair treatment and tone-aware edit-mode copy.

Extended prepGenerator, prepStore, PrepCardView, and PrepLiveMode coverage for conditionals, search, and draft filtering.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
