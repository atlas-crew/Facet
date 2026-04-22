---
id: TASK-180
title: Add "if they push" pushback script to PrepCard
status: To Do
assignee: []
created_date: '2026-04-19 10:30'
labels:
  - prep
  - types
  - generation
milestone: m-26
dependencies:
  - TASK-154
references:
  - src/types/prep.ts
  - src/utils/prepGenerator.ts
  - src/routes/prep/PrepLiveMode.tsx
documentation:
  - 'backlog reference files/blackstone-prep-r1.html (If they push card, line 592-595)'
  - 'backlog reference files/generic-prep.html (If They Push info-card, line 610-614)'
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reference prep docs include a distinct "If they push" script variant — a full alternative response for when the interviewer pushes back or asks a follow-up:

**blackstone-prep-r1.html** (why-leaving card):
> Script: "The company went through an acquisition and the new parent company restructured the team. My role was eliminated as part of that transition."
>
> **If they push:** "I was brought in to build the next-generation platform, delivered it, and the acquiring company decided to take a different technical direction with offshore development."

**generic-prep.html** (why-leaving):
> Script: [short version]
>
> **If They Push:** [expanded context, still honest but more detail]

This is distinct from:
- `PrepConditional` with `tone: 'pivot' | 'trap' | 'escalation'` — which is a short one-line follow-up answer
- `followUps` — which are preformatted Q&A pairs

The "if they push" pattern is a *full script variant* for the same question, one level deeper in honesty/detail, used only if the interviewer asks for more.

**Type addition:**

```typescript
interface PrepCard {
  // existing fields...
  pushbackScript?: string              // Expanded script if interviewer pushes
  pushbackLabel?: string               // Default: "If they push"
}
```

Minimal extension — `pushbackScript` is a string alongside `script`. Keeps the type small.

**Why not extend `PrepConditional`?**
- Conditionals are structured Q&A ("if they ask X, say Y") — short and specific
- Pushback is an *expanded answer* to the same question — longer and narrative
- Keeping them separate lets the UI distinguish the two affordances

**Generation:**

Update prompt: for cards where the primary script intentionally omits context (why-leaving, behavioral honesty moments), generate a pushbackScript that expands the answer one level — still honest, more specific, but not the first thing you volunteer.

Common cards that benefit:
- Why are you leaving
- Why this company (when the "real" reason is more nuanced)
- Tell me about a failure (the first answer is the surface; pushback is the depth)
- Technical gap framing ("I haven't used X" → pushback: "here's the closest transferable work")

**UI:**

In `PrepLiveMode.tsx`, render `pushbackScript` as a collapsed panel below the primary script, expandable with a "If they push" button. Visually de-emphasized (dimmer border) — it's a backup, not the primary. In homework mode, practice both versions separately.

**Backward compatibility:**

Optional field. Existing cards without pushbackScript render unchanged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 PrepCard has optional pushbackScript?: string and pushbackLabel?: string
- [ ] #2 prepGenerator prompt instructs generation of pushbackScript for why-leaving, failure, and gap-framing cards
- [ ] #3 pushbackScript expands the primary script with more detail — still honest, not evasive
- [ ] #4 PrepLiveMode renders pushbackScript as a collapsed "If they push" panel below the primary script
- [ ] #5 Homework mode practices primary and pushback versions separately
- [ ] #6 Existing cards without pushbackScript render unchanged
- [ ] #7 pushbackLabel defaults to "If they push" when not set
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
