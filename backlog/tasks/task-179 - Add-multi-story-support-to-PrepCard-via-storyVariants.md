---
id: TASK-179
title: Add multi-story support to PrepCard via storyVariants
status: In Progress
assignee:
  - '@codex'
created_date: '2026-04-19 10:30'
updated_date: '2026-05-09 05:20'
labels:
  - prep
  - types
  - generation
milestone: m-26
dependencies:
  - TASK-170
references:
  - src/types/prep.ts
  - src/utils/prepGenerator.ts
  - src/routes/prep/PrepLiveMode.tsx
  - src/routes/prep/PrepPracticeMode.tsx
documentation:
  - >-
    backlog reference files/blackstone-prep-r1.html (Primary + Alternative story
    pattern, lines 654-670, 692-708)
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`blackstone-prep-r1.html` shows behavioral cards with multiple story options per question, not a single story:

- **"Influence without authority"** → Primary: Northwind IDP Adoption. Alternative: VP Demo at A10. Each with its own Glance Points.
- **"Managing ambiguity"** → Primary: Post-Acquisition Rebuild. Alternative: Northwind from Scratch.
- **"Pressure / production incident"** → Primary: $1M Contract Save. Alternative: AWS Cost Crisis.

Current `PrepCard` has singular `storyBlocks` — forces one story per question. The reference pattern lets the candidate choose whichever fits the conversation flow.

**Type addition:**

```typescript
interface PrepStoryVariant {
  id: string
  label: string                      // "Primary — Northwind IDP Adoption", "Alternative — VP Demo"
  storyBlocks: PrepStoryBlock[]
  keyPoints?: string[]               // Glance points for this variant (TASK-177)
  roleContext?: string               // "Northwind", "A10" — which career era this comes from
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
- [x] #1 PrepStoryVariant type defined with id, label, storyBlocks, keyPoints?, roleContext?, when?
- [x] #2 PrepCard has optional storyVariants?: PrepStoryVariant[]
- [x] #3 Semantics: storyVariants takes precedence when set; storyBlocks is the fallback
- [x] #4 prepGenerator produces 2-3 storyVariants for behavioral cards when multiple relevant stories exist
- [x] #5 PrepLiveMode renders storyVariants as a toggle/tab selector with first variant default-expanded
- [x] #6 PrepPracticeMode treats each variant as a distinct practice unit with per-variant confidence tracking
- [x] #7 Existing cards without storyVariants render via storyBlocks fallback (no regression)
- [x] #8 Tests cover: single variant, multiple variants, no variants (fallback), confidence tracking per variant
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Starting TASK-179 after TASK-180 closure. Plan: add PrepStoryVariant type and sanitized persistence, generator schema/normalization/prompt guidance, live-mode variant selector with fallback semantics, practice-mode per-variant queue/review keys, and focused tests for generator/store/content/live/practice behavior.

Implemented PrepStoryVariant across the prep type, generator normalization/schema/prompt, sanitized persistence/import/export, live-mode story option rendering/search, and practice-mode per-variant review keys. Remediated review findings around stable variant IDs, encoded practice keys, stale progress pruning, fallback/single-variant semantics, and draft preservation. Verification: focused prep Vitest suite passed 5 files / 172 tests; scoped ESLint passed; npm run build passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added multi-story PrepCard support via storyVariants, including generator output support, sanitized persistence, live-mode story option rendering/search, and practice-mode per-variant confidence tracking. Existing storyBlocks remain the fallback when variants are absent or a single variant is paired with a top-level story; a single variant with no fallback story still renders to avoid hidden generated content. Added regression coverage for generator, store, helper, live, and practice surfaces.
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
