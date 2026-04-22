---
id: TASK-173
title: Document and apply stack alignment ↔ semantic skill depth mapping
status: To Do
assignee: []
created_date: '2026-04-19 10:30'
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
- [ ] #1 mapSkillDepthToStackConfidence() function added with documented mapping for all 7 depth levels
- [ ] #2 Calibration text influences the mapping (anti-overselling softens Strong → Solid)
- [ ] #3 prepGenerator uses the mapping explicitly when reading identity skills against JD
- [ ] #4 Prompt instruction references the mapping as the source of truth, not free-form AI translation
- [ ] #5 Tests cover each depth level, calibration-aware softening, undefined depth
- [ ] #6 Mapping documented in doc-25 as an appendix or subsection
- [ ] #7 Generation tests: regeneration produces the same confidence levels (no drift across runs)
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
