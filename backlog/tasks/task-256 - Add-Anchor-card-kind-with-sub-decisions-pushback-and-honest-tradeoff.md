---
id: TASK-256
title: 'Add Anchor card kind with sub-decisions, pushback, and honest tradeoff'
status: In Progress
assignee:
  - '@codex'
created_date: '2026-05-11 04:52'
updated_date: '2026-05-26 00:01'
labels:
  - prep
  - types
  - generator
  - renderer
milestone: m-32
dependencies:
  - TASK-254
references:
  - src/types/prep.ts
  - src/utils/prepGenerator.ts
  - src/routes/prep/PrepCardView.tsx
documentation:
  - 'backlog doc-28: Change 3 (anchor shape) + Change 4 (PrepAnchorSubDecision)'
priority: medium
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add `PrepAnchorCard` to the discriminated union introduced by TASK-254. Anchor cards represent the senior-level "one unifying narrative + many defensible sub-stories" shape: a single anchor (e.g., a major platform rebuild) with 3-5 nested sub-decisions, each its own mini-STAR. Per doc-28 Changes 3 (anchor shape) and 4 (PrepAnchorSubDecision).

`PrepAnchorCard` has `storyBlocks: PrepStoryBlock[]` (umbrella narrative) and required `subDecisions: PrepAnchorSubDecision[]`. An anchor without sub-decisions is just a story, so `subDecisions` is required (not optional).

`PrepAnchorSubDecision` carries: `id`, `title` (e.g., "Flux over Argo CD"), optional `tag` (e.g., 'GitOps' | 'IaC' | 'Architecture' | 'Cost' | 'Team'), `blocks: PrepStoryBlock[]` (problem/solution/result reuse — keeps the existing renderer logic composable), `pushbackResponse?: string` (the anticipated pushback + the prepared counter — "If they push, here's what I say"), and `honestTradeoff?: string` (acknowledged cost of the choice — what makes senior candidates sound senior).

The renderer shows the umbrella narrative + a vertical list of sub-decision blocks, each with collapsible problem/solution/result + pushback callout + tradeoff callout. The generator emits one anchor per technical round with 3-5 sub-decisions, each carrying problem/solution/result + pushback + tradeoff.

Depends on TASK-254 — without the union foundation there is no `kind` dispatcher to hook the anchor renderer into.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 PrepAnchorCard interface in src/types/prep.ts declares kind: 'anchor', storyBlocks: PrepStoryBlock[], and required subDecisions: PrepAnchorSubDecision[]
- [ ] #2 PrepAnchorSubDecision type defined with id, title, tag?, blocks: PrepStoryBlock[], pushbackResponse?, honestTradeoff?
- [ ] #3 isAnchorCard type guard exported from src/types/prep.ts
- [ ] #4 PrepCardView anchor branch renders the umbrella narrative + vertical list of sub-decisions, each with problem/solution/result + pushbackResponse callout + honestTradeoff callout
- [ ] #5 prepGenerator.ts includes an anchor sub-prompt; emits one anchor card per technical round with 3-5 sub-decisions when round-type warrants
- [ ] #6 Contract validator asserts subDecisions is non-empty (length >= 1, ideally >= 3) on every anchor card
- [ ] #7 Regression tests cover renderer (sub-decision visibility, pushback/tradeoff callouts) and generator emission of anchor cards with sub-decisions
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-05-25 Codex starting TASK-256. Plan: read doc-28 anchor-card design and current TASK-254 prep discriminated-union implementation; add PrepAnchorCard/PrepAnchorSubDecision + isAnchorCard; update PrepCardView renderer with umbrella story plus sub-decision list/callouts; update prepGenerator prompt/normalization/contract validation to emit/accept anchor cards with non-empty subDecisions; add focused renderer and generator/validator regression tests; run scoped tests, typecheck/lint/format, independent review/audit, commit with cortex git commit, then close with receipts.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Regression tests pass (scoped to touched files)
- [ ] #5 Linters report no warnings or errors in touched files
- [ ] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
