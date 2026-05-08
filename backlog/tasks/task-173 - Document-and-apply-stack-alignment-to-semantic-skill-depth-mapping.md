---
id: TASK-173
title: Document and apply stack alignment ↔ semantic skill depth mapping
status: Done
assignee:
  - '@codex'
created_date: '2026-04-19 10:30'
updated_date: '2026-05-08 23:43'
labels:
  - prep
  - identity-model
  - mapping
milestone: m-20
dependencies:
  - TASK-150
references:
  - src/types/prep.ts
  - src/utils/prepGenerator.ts
  - src/identity/schema.ts
documentation:
  - 'backlog doc-25: current state'
modified_files:
  - src/utils/prepSkillDepthMapping.ts
  - src/utils/prepGenerator.ts
  - src/test/prepSkillDepthMapping.test.ts
  - src/test/prepGenerator.test.ts
  - >-
    backlog/docs/doc-25 -
    Prep-Workspace-Gap-Analysis-—-Strategy-Layer-Round-Progression.md
  - >-
    backlog/docs/doc-41 -
    Prep-V2-—-PrepDeck-Foundation-Content-Extensions-Rollout-Plan.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`PrepStackAlignmentConfidence` has 5 levels (`Strong` | `Solid` | `Working knowledge` | `Adjacent experience` | `Gap`) and `SearchSkillDepth` has 7 (`expert` | `strong` | `hands-on-working` | `architectural` | `conceptual` | `basic` | `avoid`). The reference prep docs use the 5-level confidence consistently, but there's no documented mapping between them. When prep generation reads identity skills, the lossy mapping is silent.

**Add mapping function** to `prepGenerator.ts` (or a dedicated mapping utility):

```typescript
function mapSkillDepthToStackConfidence(
  depth: ProfessionalSkillDepth | SearchSkillDepth | undefined,
  calibration?: string,
): PrepStackAlignmentConfidence {
  // expert        → 'Strong'
  // strong        → 'Strong'
  // hands-on-working → 'Solid'
  // architectural → 'Solid'        (but see calibration)
  // working       → 'Working knowledge'
  // conceptual    → 'Adjacent experience'
  // basic         → 'Adjacent experience' or 'Gap' (context-dependent)
  // avoid         → 'Gap'
  // undefined     → 'Gap'
}
```

**Calibration-aware refinement:**

When the user has explicit calibration notes (e.g., "not a K8s admin, builds platforms around K8s"), the mapping should soften: a `strong` skill with anti-overselling calibration might map to `'Solid'` instead of `'Strong'` to prevent the prep from overclaiming during interviews.

**Update `prepGenerator.ts`:**

When building stack alignment from identity skills against the JD, use this mapping explicitly. Surface the mapping in the generation prompt as the source of truth — don't let the AI invent its own translation.

**Document in doc-25** as a subsection of Gap 5 (Stack Alignment), or a new appendix.

**Tests:**

- Each depth value maps to an expected confidence level
- Calibration softens 'Strong' to 'Solid' when calibration includes anti-overselling language
- Undefined depth with no evidence maps to 'Gap'

**Why this matters:**

Prep generation against identity happens per-deck. A lossy mapping means "my identity says I'm expert in X" silently becomes "Strong" in prep, and might become "Solid" on the next regeneration. Making the mapping explicit + tested eliminates drift.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 mapSkillDepthToStackConfidence() function added with documented mapping for all 7 depth levels
- [x] #2 Calibration text influences the mapping (anti-overselling softens Strong → Solid)
- [x] #3 prepGenerator uses the mapping explicitly when reading identity skills against JD
- [x] #4 Prompt instruction references the mapping as the source of truth, not free-form AI translation
- [x] #5 Tests cover each depth level, calibration-aware softening, undefined depth
- [x] #6 Mapping documented in doc-25 as an appendix or subsection
- [x] #7 Generation tests: regeneration produces the same confidence levels (no drift across runs)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Starting TASK-173. Plan: document the explicit identity skill depth → PrepStackAlignmentConfidence mapping, add a reusable mapping utility, wire the prep prompt/context to use it as source-of-truth, and cover the mapping + prompt contract with focused tests.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented explicit identity/search skill depth to PrepStackAlignmentConfidence mapping in src/utils/prepSkillDepthMapping.ts. Prep generation now annotates Canonical JD Analysis skillMatches with prepStackConfidence, gives the prompt the mapping as source of truth, and caps returned stackAlignment confidence from the mapped skill ceiling. Documented the mapping in doc-25 and marked TASK-173 done in doc-41. Verification: npm run format:files -- src/utils/prepSkillDepthMapping.ts src/utils/prepGenerator.ts src/test/prepSkillDepthMapping.test.ts src/test/prepGenerator.test.ts backlog/docs/doc-25...; npx vitest run src/test/prepSkillDepthMapping.test.ts src/test/prepGenerator.test.ts (30 tests); npx eslint src/utils/prepSkillDepthMapping.ts src/utils/prepGenerator.ts src/test/prepSkillDepthMapping.test.ts src/test/prepGenerator.test.ts; npm run typecheck; npm run build. Review: specialist-review.sh --git -- src/utils/prepSkillDepthMapping.ts src/utils/prepGenerator.ts, final validated pass was followed by additional hardening for non-blocking review notes.
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
