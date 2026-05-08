---
id: TASK-128
title: Wire identity store into prep generation
status: Done
assignee:
  - codex
created_date: '2026-04-16 09:45'
updated_date: '2026-04-16 10:40'
labels:
  - prep
  - identity
  - generation
milestone: m-17
dependencies:
  - TASK-127
references:
  - docs/development/plans/live-cheatsheet-content-v2.md
  - src/routes/prep/PrepPage.tsx
  - src/store/identityStore.ts
  - src/identity/schema.ts
  - src/utils/prepGenerator.ts
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Connect identityStore to the prep generation flow so the AI receives structured career data instead of flat resume text.

**Changes to PrepPage.tsx:**
- Import `useIdentityStore` and read `currentIdentity`
- Build a focused identity context by filtering to vector-relevant roles/bullets/skills
- Pass to generation alongside existing resumeContext

**Identity context assembly (new utility or inline):**
- Filter roles to those relevant to the target vector
- Include structured bullets: `problem`, `action`, `outcome`, `impact[]`, `metrics{}`
- Include skills with `depth` and `positioning`
- Include `self_model.interview_style` if available
- Skip irrelevant sections (philosophy, education, generator_rules)

**Changes to PrepGenerationRequest:**
- Add optional `identityContext` field alongside existing `resumeContext`
- When identity is loaded, prefer it. When null, fall back to resumeContext.

**Architectural rule:** This is a pure read from identityStore. No writes. Identity is the sole extraction authority — prep does not re-extract structure from flat text.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 PrepPage.tsx imports and reads from identityStore
- [x] #2 Identity context is filtered to vector-relevant roles and skills
- [x] #3 PrepGenerationRequest accepts optional identityContext
- [x] #4 When identity is loaded, generation uses structured bullets (not flat resume text)
- [x] #5 When identity is null, generation falls back to existing resumeContext path
- [x] #6 No writes to identityStore from prep code
- [ ] #7 TypeScript compiles cleanly
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Owner: main rollout (codex) after TASK-127 lands.
Scope: wire identityStore read-only context into prep generation, preferring structured identityContext with resumeContext fallback.
Files expected: src/routes/prep/PrepPage.tsx plus src/utils/prepGenerator.ts or a nearby prep utility if extraction logic is split.
Validation: focused prep generation tests plus typecheck.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started implementation after TASK-127 foundation commit feat(prep): add rich cheatsheet schema.

Completed in two atomic commits: feat(prep): derive structured identity context; feat(prep): wire identity context into generation.

Focused validation passed: npx vitest run src/test/prepGenerator.test.ts src/test/prepIdentityContext.test.ts src/test/PrepPage.identityGeneration.test.tsx

Post-commit wiring validation passed: npx vitest run src/test/PrepPage.identityGeneration.test.tsx

Full typecheck remains blocked by unrelated rendering-lane debt: src/routes/prep/PrepLiveMode.tsx(41,7) TS6133 QUESTIONS_GUIDANCE is unused.

Independent test-audit signoff confirmed focused coverage is sufficient for TASK-128 after fallback and immutability tests were added.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Wired prep generation to read currentIdentity from identityStore without mutating it, added structured identityContext support to PrepGenerationRequest and prompt assembly, derived vector-relevant roles/skills/self-model data in a new prep identity utility, and added focused prompt, derivation, and page integration tests. Validation: focused Vitest suites passed; full repo typecheck is currently blocked by an unrelated PrepLiveMode unused-constant error outside this task's write scope.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
