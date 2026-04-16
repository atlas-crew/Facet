---
id: TASK-144
title: Implement context gap feedback loop with identity drafts
status: To Do
assignee: []
created_date: '2026-04-16 13:14'
labels:
  - prep
  - identity
  - generation
  - ui
  - feedback-loop
milestone: m-18
dependencies: []
references:
  - docs/development/plans/live-cheatsheet-content-v2.md#B8
  - src/store/identityStore.ts
  - src/routes/debrief/DebriefPage.tsx
  - src/routes/prep/PrepPage.tsx
  - src/utils/prepGenerator.ts
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When the AI generation lacks sufficient context to produce quality content, it should flag the gaps explicitly. The user fills them in via a guided modal, and answers flow back to the identity model through the draft mechanism.

**Generation response addition:**
```typescript
interface PrepContextGap {
  id: string
  section: string
  question: string
  why: string
  feedbackTarget?: string  // e.g., 'identity.departureContext', 'deck.interviewerNotes'
  priority: 'required' | 'recommended' | 'optional'
}
```
Add `contextGaps?: PrepContextGap[]` to generation response. Store on PrepDeck as `contextGaps` and `contextGapAnswers: Record<string, string>`.

**Generation behavior when gaps exist:**
- Generate with caveat: produce section but mark `[needs review]` — when model can reasonably infer
- Generate placeholder: skeleton with `[fill in: ...]` — when model cannot safely infer
- Skip section: just flag the gap — when section would be entirely fabricated

**Edit page banner:**
After generation, if contextGaps is non-empty, show banner: "This prep set is missing context that would improve N sections. [Fill in the gaps →]"

**Guided modal:**
- Steps through gaps in priority order (required → recommended → optional)
- Each step shows the question, why it matters, and an appropriate input
- "Skip" option for non-required gaps
- On submit: stores answer in `deck.contextGapAnswers[gapId]`

**Identity draft pipeline:**
- A utility converts relevant answers to an `IdentityExtractionDraft`
- Calls `identityStore.setDraft()` to queue identity changes
- User reviews and applies in the identity workspace
- **Prep NEVER calls identity mutation actions directly** — same pattern as debrief

**Cheatsheet rendering:**
- Placeholder/needs-review content renders with dashed border and muted opacity
- Small indicator badge on affected cards

**Re-generation:**
- After filling gaps, user can re-generate affected sections with the new context
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 PrepContextGap type defined
- [ ] #2 contextGaps and contextGapAnswers fields added to PrepDeck
- [ ] #3 Generation response includes contextGaps when model lacks context
- [ ] #4 Edit page shows banner with gap count when gaps present
- [ ] #5 Guided modal steps through gaps with appropriate inputs
- [ ] #6 Answers stored on deck.contextGapAnswers
- [ ] #7 Relevant answers converted to IdentityExtractionDraft and queued via setDraft()
- [ ] #8 No direct identity mutation calls from prep code
- [ ] #9 Placeholder content visually distinguished in cheatsheet
- [ ] #10 Re-generation of affected sections supported after gap fill
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
