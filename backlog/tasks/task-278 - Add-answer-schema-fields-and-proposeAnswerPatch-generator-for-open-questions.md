---
id: TASK-278
title: Add answer schema fields and proposeAnswerPatch generator for open questions
status: To Do
assignee: []
created_date: '2026-06-05 17:14'
labels: []
milestone: m-34
dependencies: []
references:
  - 'src/identity/schema.ts:267'
  - 'src/utils/identityParametersGeneration.ts:562'
  - 'src/types/identity.ts:64'
documentation:
  - >-
    specs/answerable-identity-open-questions/doc-45 -
    Answerable-Identity-Open-Questions-—-Design.md
priority: medium
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Data + AI foundation for letting users answer Identity open questions. Adds the schema fields that record an answer and resolution, and the LLM generator that turns a user's free-text answer into a concrete, layer-correct proposed patch to the identity model.

WHY: Today the awareness builder (TASK-102.5) only generates and edits open questions — there is no way to answer one and have it update the identity. This task supplies the data shape and the proposal engine that the store (task 2) and inspector UI (task 3) build on.

Architectural constraints (see doc-45):
- Patch must be a discriminated union over the target LAYER so facts route to evidence (roles/skills) and interpretation routes to narrative (Self Model) — evidence-vs-narrative must not collapse.
- The generator must ground every proposal ONLY in the user's answer text — it must not invent metrics or claims the user did not supply — and must honor generator_rules.accuracy. A confidently-wrong fabricated bullet is worse than none.
- Schema fields are additive optional; pre-launch, no migration.

Key files: src/identity/schema.ts (type at 267-279, validator at 983-1018); src/utils/identityParametersGeneration.ts (mirror generateAwarenessFromIdentity at 562-599 and the callLlmProxy → parseGeneratedPayload → normalize pattern); patch type in src/types/identity.ts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ProfessionalOpenQuestion gains optional answer?: string and resolved?: boolean fields; the hydration validator in schema.ts parses both as optional without breaking existing snapshots
- [ ] #2 An AnswerPatch discriminated union is defined covering at minimum role-bullet, skill, and a self-model target (arc / competitive-moat / unfair-advantage)
- [ ] #3 proposeAnswerPatch(identity, question, answerText, endpoint) calls the LLM proxy following the existing generator pattern and returns a normalized AnswerPatch
- [ ] #4 The generator prompt instructs the model to ground the patch only in the user's answer (no invented claims) and to respect generator_rules.accuracy
- [ ] #5 Normalization rejects patches whose discriminant is unknown or whose referenced roleId/groupId does not exist in the identity, surfacing a parse error like the other generators
- [ ] #6 Tests cover: each patch kind normalizes correctly, unknown-id and unknown-kind are rejected, and malformed JSON is handled via the existing JsonExtractionError path
- [ ] #7 Tests assert the prompt/normalizer does not fabricate content beyond the supplied answer (e.g. answer with no metric does not yield a metric-bearing bullet)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Regression tests pass (scoped to touched files)
- [ ] #5 Linters report no warnings or errors in touched files
- [ ] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
