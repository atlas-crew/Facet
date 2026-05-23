---
id: TASK-173
title: Document and apply stack alignment ↔ semantic skill depth mapping
status: Done
assignee:
  - '@codex'
created_date: '2026-04-19 10:30'
updated_date: '2026-05-09 04:20'
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
Implemented explicit identity/search skill depth to PrepStackAlignmentConfidence mapping in src/utils/prepSkillDepthMapping.ts. Prep generation now annotates Canonical JD Analysis skillMatches with prepStackConfidence, gives the prompt the mapping as source of truth, and caps returned stackAlignment confidence from the mapped skill ceiling. Documented the mapping in doc-25 and marked TASK-173 done in doc-41. Verification: npm run format:files -- src/utils/prepSkillDepthMapping.ts src/utils/prepGenerator.ts src/test/prepSkillDepthMapping.test.ts src/test/prepGenerator.test.ts backlog/docs/doc-25...; npx vitest run src/test/prepSkillDepthMapping.test.ts src/test/prepGenerator.test.ts (30 tests); npx eslint src/utils/prepSkillDepthMapping.ts src/utils/prepGenerator.ts src/test/prepSkillDepthMapping.test.ts src/test/prepGenerator.test.ts; npm run typecheck; npm run build. Review: specialist-review.sh --git -- src/utils/prepSkillDepthMapping.ts src/utils/prepGenerator.ts was run through multiple iterations; reviewer-raised P1 issues were hardened in the final code before local gates passed.

**Correction (2026-05-09):** the rationale in the Final Summary above ("closed as fully subsumed") was based on an audit snapshot that missed concurrent work. While the audit was running, commit `ba040e6 feat(prep): map skill depth to stack confidence` (2026-05-08 19:43) shipped the actual mapping mechanism in a richer form than the original task proposed:

- `src/utils/prepSkillDepthMapping.ts` (NEW, 130 LOC): exports `PrepSkillDepth` (union of `ProfessionalSkillDepth | SearchSkillDepth`), `PREP_SKILL_DEPTH_CONFIDENCE_ROWS` (table-driven mapping for all 7 depth levels), `MISSING_SKILL_DEPTH_CONFIDENCE`, plus calibration helpers (`buildStackAlignmentConfidenceCeilings`, `applyStackAlignmentConfidenceCeilings`, `findStackAlignmentConfidenceCeiling`, `pickLowerStackConfidence`, `isLowerStackConfidence`, `warnStackAlignmentConfidenceCollision`).
- `src/test/prepSkillDepthMapping.test.ts` (NEW, 68 LOC): dedicated coverage for mapping + calibration ceilings.
- `src/utils/prepGenerator.ts` (+133 LOC): wires the mapping into generation; collision warnings surface.
- `src/test/prepGenerator.test.ts` (+128 LOC): integration coverage.

The richer shape (table + ceilings + collision warnings) addresses original ACs #1–7 in a more durable way than a single `mapSkillDepthToStackConfidence` function would have. Calibration is implemented as confidence ceilings (`applyStackAlignmentConfidenceCeilings`) rather than as a single calibration parameter on the mapping function — same outcome (anti-overselling Strong→Solid), better separation of concerns.

So the correct closure rationale is **shipped as a richer mechanism**, not **subsumed**. The audit conclusion that JDAnalysis.skillMatches projects userDepth/matchQuality/presentationGuidance directly is also true (the canonical projection IS available), but the team chose to ship explicit prep-side mapping on top of it for the calibration/collision-warning ergonomics. Both observations stand; the closure verdict (Done) is correct.
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
