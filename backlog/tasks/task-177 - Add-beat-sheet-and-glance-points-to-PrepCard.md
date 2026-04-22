---
id: TASK-177
title: Add beat sheet and glance points to PrepCard
status: To Do
assignee: []
created_date: '2026-04-19 10:30'
labels:
  - prep
  - types
  - live-mode
milestone: m-26
dependencies:
  - TASK-154
references:
  - src/types/prep.ts
  - src/utils/prepGenerator.ts
  - src/routes/prep/PrepLiveMode.tsx
documentation:
  - 'backlog reference files/blackstone-prep-r3.html (Beat sheet, line 518)'
  - 'backlog reference files/blackstone-prep-r1.html (Glance Points pattern, lines 556, 574, 601)'
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reference prep docs use two distinct compressed-recall patterns:

**Beat Sheet** (`blackstone-prep-r3.html:518-527`) — a numbered fallback for the opener, rendered as a separate panel below the full script:

> **Beat sheet — if you lose your place**
> 1. Eight years, platform = making engineers' lives easier
> 2. Vispero → first platform hire, IDP, 600 pipelines, $50M/yr
> 3. ThreatX → K8s migration, fleet management, 3 years
> 4. A10 → acquisition, solo rebuild, air-gapped/GDPR
> 5. Why Blackstone → ownership problem, scale, learn + teach

**Glance Points** (`blackstone-prep-r1.html`) — per-card bulleted compressed version next to every behavioral card:

> Glance Points — Use the On-Prem Project
> - On-prem deployment project was a month behind when I got it
> - Brought it back on track, delivered the demo milestone on time solo
> - Then got pulled off it to do frontend work — transition wasn't clean
> - **The failure:** I should have pushed harder to document the handoff...
> - **What I learned:** Delivery isn't just shipping...

Current `PrepCard.keyPoints: string[]` semantically covers both, but:
- Not distinguished by purpose (beat sheet vs glance points are different UX affordances)
- Not emphasized in live-mode rendering (currently probably just a bulleted list)

**Option A (minimal, recommended):**

Keep `keyPoints[]` as the single field; update the generator and live-mode UI to render it prominently. Prompt instructs two patterns:
- For opener and core-pitch cards: keyPoints is a "beat sheet" — short one-liners numbered, the script's fallback-under-pressure
- For behavioral cards: keyPoints is "glance points" — the compressed bulleted version of the answer

Live-mode renders keyPoints in a distinct panel (monospace, numbered if opener/core-pitch, bulleted otherwise), visually separate from the full script.

**Option B (richer types):**

```typescript
interface PrepCard {
  // existing fields...
  beatSheet?: string[]              // Numbered, opener/core-pitch only
  glancePoints?: string[]           // Bulleted, behavioral/situational
}
```

Deprecate or repurpose `keyPoints` as a fallback.

**Recommendation:** Start with Option A. If over time the two shapes diverge in generation/rendering needs, migrate to Option B.

**Generation prompt changes:**

- Opener and core-pitch cards must have 5-7 numbered beat sheet keyPoints
- Behavioral cards must have 3-6 bulleted glance points as keyPoints
- Both should compress the full script into one-liners that work as recall aids under pressure

**Live-mode UI:**

Render keyPoints as a distinct panel below the full script:
- Monospace font, smaller than body text
- Numbered list for opener/core-pitch
- Bulleted list for behaviorals
- Label: "Beat sheet — if you lose your place" or "Glance Points"
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 prepGenerator prompt instructs opener/core-pitch cards to have 5-7 numbered beat sheet keyPoints
- [ ] #2 prepGenerator prompt instructs behavioral cards to have 3-6 bulleted glance point keyPoints
- [ ] #3 PrepLiveMode renders keyPoints as a distinct labeled panel below the script (not inline)
- [ ] #4 Opener/core-pitch cards render numbered keyPoints; behaviorals render bulleted
- [ ] #5 Label differs based on card category: "Beat sheet — if you lose your place" vs "Glance Points"
- [ ] #6 Existing keyPoints data continues to render (backward compatible)
- [ ] #7 Homework mode shows keyPoints during grading as a reveal alongside the full answer
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
