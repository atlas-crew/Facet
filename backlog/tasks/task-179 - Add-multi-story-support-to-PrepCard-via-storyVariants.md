---
id: TASK-179
title: Add multi-story support to PrepCard via storyVariants
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
  - TASK-177
references:
  - src/types/prep.ts
  - src/utils/prepGenerator.ts
  - src/routes/prep/PrepLiveMode.tsx
  - src/routes/prep/PrepPracticeMode.tsx
documentation:
  - 'backlog reference files/blackstone-prep-r1.html (Primary + Alternative story pattern, lines 654-670, 692-708)'
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`blackstone-prep-r1.html` shows behavioral cards with multiple story options per question, not a single story:

- **"Influence without authority"** → Primary: Vispero IDP Adoption. Alternative: VP Demo at A10. Each with its own Glance Points.
- **"Managing ambiguity"** → Primary: Post-Acquisition Rebuild. Alternative: Vispero from Scratch.
- **"Pressure / production incident"** → Primary: $1M Contract Save. Alternative: AWS Cost Crisis.

Current `PrepCard` has singular `storyBlocks` — forces one story per question. The reference pattern lets the candidate choose whichever fits the conversation flow.

**Type addition:**

```typescript
interface PrepStoryVariant {
  id: string
  label: string                      // "Primary — Vispero IDP Adoption", "Alternative — VP Demo"
  storyBlocks: PrepStoryBlock[]
  keyPoints?: string[]               // Glance points for this variant (TASK-177)
  roleContext?: string               // "Vispero", "A10" — which career era this comes from
  when?: string                      // When to pick this variant ("if they care about X")
}

interface PrepCard {
  // existing fields...
  storyVariants?: PrepStoryVariant[]  // Multi-story support
  // Keep existing storyBlocks as the fallback/primary when storyVariants is unset
}
```

**Semantics:**

- When `storyVariants` is set with 2+ entries, it takes precedence over `storyBlocks`
- When `storyVariants` has 1 entry or is empty, fall back to singular `storyBlocks`
- The first entry in `storyVariants` is the primary/default; alternates are discoverable via UI

**Generation:**

Update prompt: for behavioral cards where the identity has multiple relevant stories (from PAIO bullets across multiple roles), generate 2-3 storyVariants. Each variant labels the role context and optionally notes when to pick it ("use this if they emphasize autonomy", "use this if they emphasize mentorship").

**UI:**

In `PrepLiveMode.tsx`, render behavioral cards with storyVariants as a toggleable selector at the top of the card body — like a tab switcher between "Primary", "Alternative 1", "Alternative 2". Default to the first variant expanded.

In `PrepPracticeMode.tsx` (homework), practice each variant separately — confidence tracking per variant, not per card.

**Backward compatibility:**

Existing cards with only `storyBlocks` continue to render via the fallback path. Migration is additive.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 PrepStoryVariant type defined with id, label, storyBlocks, keyPoints?, roleContext?, when?
- [ ] #2 PrepCard has optional storyVariants?: PrepStoryVariant[]
- [ ] #3 Semantics: storyVariants takes precedence when set; storyBlocks is the fallback
- [ ] #4 prepGenerator produces 2-3 storyVariants for behavioral cards when multiple relevant stories exist
- [ ] #5 PrepLiveMode renders storyVariants as a toggle/tab selector with first variant default-expanded
- [ ] #6 PrepPracticeMode treats each variant as a distinct practice unit with per-variant confidence tracking
- [ ] #7 Existing cards without storyVariants render via storyBlocks fallback (no regression)
- [ ] #8 Tests cover: single variant, multiple variants, no variants (fallback), confidence tracking per variant
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
