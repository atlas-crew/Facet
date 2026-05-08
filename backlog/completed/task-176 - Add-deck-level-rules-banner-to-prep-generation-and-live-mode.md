---
id: TASK-176
title: Add deck-level rules banner to prep generation and live mode
status: Done
assignee:
  - Codex
created_date: '2026-04-19 10:00'
updated_date: '2026-04-22 09:03'
labels:
  - prep
  - prompt-engineering
  - ux
milestone: m-26
dependencies:
  - TASK-154
references:
  - src/types/prep.ts
  - src/utils/prepGenerator.ts
  - src/routes/prep/PrepLiveMode.tsx
documentation:
  - 'backlog doc-25: Gap 2 Strategic Framing Notes'
  - backlog reference files/blackstone-prep-r3.html (rules-banner pattern)
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The `blackstone-prep-r3.html` reference renders a "The Rules" banner at the top of the deck with 3-5 imperative one-liners:

> • Problem → Solution → Result. Every answer. Under 90 seconds.
> • Don't flex. Don't lecture. Be the senior you wish you'd had.
> • Listen more than you talk. If you're monologuing, stop.
> • Their question: **"Do I want this person above me every day?"**

These are deck-scoped imperatives for delivery — distinct from per-card `warning` fields and distinct from `categoryGuidance`. Deck-level framing that applies to *every* answer in the session.

TASK-154 added deck-level framing via `categoryGuidance` and `notes`, but didn't add a structured rules surface.

**Schema:**

Add to `PrepDeck`:
```typescript
rules?: string[]  // 3-5 imperative one-liners, deck-scoped
```

**Generation:**

Update `prepGenerator.ts` system prompt to produce a `rules` array — 3-5 imperative one-liners tailored to the interview round type, application method, and round number. Examples:

- For inbound-recruiter screens: "Be conversational. They already think there's fit." / "They reached out. Don't oversell."
- For cold-apply screens: "Earn attention in the first 2 minutes." / "Lead with specificity."
- For HM rounds: "Their question: Do I want this person above me?" / "Listen more than you talk."
- For system-design rounds: "Probe constraints before proposing. Ask at least 2 clarifying questions first."

**UI:**

Render rules as a fixed banner at the top of `PrepLiveMode.tsx`, visible throughout the session. Collapsible but default-open. Distinct visual treatment from `warning` boxes (accent border, imperative iconography).

Keep existing `notes`, `warning`, `categoryGuidance` fields untouched — rules are *additive*, not a replacement.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 PrepDeck has optional rules: string[] field
- [ ] #2 prepGenerator produces 3-5 rules tailored to round type, application method, and round number
- [ ] #3 Rules rendered as a fixed banner at the top of PrepLiveMode, collapsible but default-open
- [ ] #4 Rules visible in PrepPracticeMode (homework) and PrepPage (edit) with consistent styling
- [ ] #5 Editable in edit mode — user can refine, add, or remove rules
- [ ] #6 Empty rules array does not render an empty banner
- [ ] #7 Prompt instruction requires imperative one-liners, not passive-voice guidance
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Add a structured `rules?: string[]` field to prep deck generation/types so deck-level interview imperatives have a first-class home distinct from per-card warnings and category guidance.
Update prep generation to request 3 to 5 imperative one-liners tailored to round/application context, normalize the returned rules, and carry them into generated decks.
Render the rules surface consistently across live mode, homework mode, and the edit workspace, including deck-level editing controls and empty-state guards, then add focused tests and run the prep verification/review loop.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
