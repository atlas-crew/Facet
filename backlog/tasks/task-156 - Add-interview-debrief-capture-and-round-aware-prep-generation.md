---
id: TASK-156
title: Add interview debrief capture and round-aware prep generation
status: To Do
assignee: []
created_date: '2026-04-19 06:03'
labels:
  - prep
  - feedback-loop
milestone: m-26
dependencies:
  - TASK-154
references:
  - src/types/prep.ts
  - src/store/prepStore.ts
  - src/utils/prepGenerator.ts
  - src/routes/prep/PrepPage.tsx
documentation:
  - 'backlog doc-25: Gap 6 Round Progression'
  - 'backlog doc-26: Stage 6 Interview Debrief'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The biggest structural gap in the prep workspace: no mechanism to debrief after an interview round and feed learnings into the next round's prep. The Blackstone R3 reference prep shows how R1 intel transforms R2/R3 strategy.

**Debrief capture** — Reference analysis (see `blackstone-prep-r3.html`) showed that round intel is rendered as a structured grid of category-labeled cells, not a free-text notes field. Updated schema:

```typescript
interface PrepRoundDebrief {
  round: number
  date: string
  // Structured intel grid (matches the reference's intel-grid pattern)
  intel: {
    teamCulture?: string       // "VP from England, casual about titles. Team is global."
    aiUsage?: string            // "Using Claude already. Lean in more."
    topChallenge?: string       // "Ownership and not burdening dev teams — this is your pitch."
    volume?: string             // "Sheer volume of work. Empathize, don't promise to fix."
    securityPosture?: string    // "3 teams: SOC, AppSec, compliance."
    goodSigns?: string[]        // "10-min detailed answers to my questions — they were selling."
    redFlags?: string[]
    other?: Record<string, string>  // Extensibility for category-labeled intel
  }
  questionsAsked: string[]
  surprises: string[]
  newIntel: string[]
  notes?: string                // Free-text overflow
}

// Also: PrepDeck gains roundNumber
interface PrepDeck {
  // existing fields...
  roundNumber?: number         // Which round this deck is for (R1, R2, R3)
  roundDebriefs?: PrepRoundDebrief[]
}
```

**Per-story round state** — Reference analysis (see `blackstone-prep-r3.html:689` showing "⚠ This fumbled in Round 1" + red "PRACTICE THIS" tag on a story card) showed that round progression is *card-level state*, not just deck-level debrief. Add to PrepCard:

```typescript
interface PrepCardRoundState {
  round: number
  status: 'worked' | 'fumbled' | 'untested' | 'practice-this'
  notes?: string               // "You pulled individual facts instead of telling a story. Say it out loud 5 times before the call."
}

interface PrepCard {
  // existing fields...
  perRoundState?: PrepCardRoundState[]
}
```

**Debrief form UX:**
1. User completes interview round
2. User opens prep deck → sees "Add Debrief" prompt
3. Form has *two modes*:
   - **Quick capture** — grid of category-labeled text inputs (teamCulture, aiUsage, topChallenge, volume, etc.) with tag-input for questions/surprises/newIntel
   - **Per-card review** — list of cards that were relevant; user marks each `worked` / `fumbled` / `practice-this` with optional notes
4. Debrief stored on deck

**Round-aware generation** — When generating prep for round N+1, include both:
- Previous round debriefs (structured intel grid)
- Per-card round state ("story X fumbled in R1 — rewrite with remediation")

The AI should:
- Carry forward `perRoundState.notes` as framing for the card in the new round ("This fumbled in R1 because you pulled facts — rewrite as P-S-R story under 60 seconds")
- Generate new `rules[]` (TASK-176) incorporating R1 intel ("Their #1 challenge is ownership — lead every answer with ownership framing")
- Surface R1 intel-grid categories as structured card content in R2's prep

**Deck structure for multi-round:**
- Multiple PrepDecks per `pipelineEntryId`, each with `roundNumber`
- Grouped in UI by pipelineEntryId; selecting a round loads the right deck
- Stories/cards can be carried forward from R1 to R2 via "copy from previous round" action, preserving per-card round state

**Contradiction handling:**
- If debrief says "opener worked" but questionsAsked suggests they cut you off, prompt the AI to flag the contradiction rather than silently resolve

Reference: doc-25 Gap 6, doc-26 Stage 6, `blackstone-prep-r3.html` (intel-grid + per-card round state).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 PrepDeck type has optional roundNumber?: number and roundDebriefs?: PrepRoundDebrief[] fields
- [ ] #2 PrepRoundDebrief has structured intel grid (teamCulture, aiUsage, topChallenge, volume, securityPosture, goodSigns, redFlags, other) plus questionsAsked/surprises/newIntel/notes
- [ ] #3 PrepCard has optional perRoundState?: PrepCardRoundState[] with round/status/notes (status = worked | fumbled | untested | practice-this)
- [ ] #4 Debrief form has quick-capture mode (intel grid) and per-card review mode (mark cards worked/fumbled)
- [ ] #5 Debrief data persists in prepStore across sessions
- [ ] #6 When generating prep for round N+1, prompt includes both structured debrief intel and per-card round state
- [ ] #7 Cards flagged perRoundState.status='fumbled' are regenerated in R2+ with remediation framing; cards flagged 'practice-this' are tagged accordingly in the new deck
- [ ] #8 AI generation produces deck-level rules (TASK-176) informed by R1 intel (e.g., top challenge becomes a rules-banner item)
- [ ] #9 Multi-round decks grouped in UI by pipelineEntryId; selecting a round loads the right deck
- [ ] #10 "Copy from previous round" action preserves perRoundState on carried-forward cards
- [ ] #11 Contradictions between debrief fields (e.g., "opener worked" + "they cut you off" in questionsAsked) are surfaced to the AI as a flag
- [ ] #12 Debrief form is lightweight — not a 20-field survey; intel grid defaults to 6 visible fields with "more" toggle
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
