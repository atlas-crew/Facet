---
id: TASK-278
title: Add answer schema fields and proposeAnswerPatch generator for open questions
status: In Progress
assignee: []
created_date: '2026-06-05 17:14'
updated_date: '2026-06-06 21:38'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan (grounded in current code)

### Design refinements discovered during planning (override doc-45 sketch)
- `ProfessionalRoleBullet` (src/identity/schema.ts:203-214) is a STRUCTURED object
  `{ id, problem, action, outcome, impact[], metrics, technologies[], tags[], source_text?, portfolio_dive? }`,
  NOT a flat string. The `role-bullet` patch must therefore carry structured fields, not `{ text }`.
  `metrics` MUST remain `{}` unless the user's answer literally contains a number — this is where the
  no-fabrication guardrail bites hardest.
- `ProfessionalIdentityArcEntry` (schema.ts:50-53) is `{ company, chapter }` — the `self-model-arc` patch entry mirrors that exactly.
- Skill add uses `addSkillToCurrentIdentity(groupId, skillName)`, so the `skill` patch needs `{ groupId, skillName }` and the normalizer must verify `groupId` exists in `identity.skills.groups`.

### Final AnswerPatch shape (add to src/types/identity.ts, near ProposedSearchVector ~line 45)
```ts
export type AnswerPatch =
  | { kind: 'role-bullet'; roleId: string; bullet: { problem: string; action: string; outcome: string; impact?: string[]; metrics?: Record<string, string | number | boolean>; technologies?: string[]; tags?: string[] } }
  | { kind: 'skill'; groupId: string; skillName: string }
  | { kind: 'self-model-arc'; entry: { company: string; chapter: string } }
  | { kind: 'competitive-moat'; text: string }
  | { kind: 'unfair-advantage'; items: string[] }
```
Rationale: discriminant = target LAYER (evidence vs narrative). Import `ProfessionalIdentityArcEntry`/bullet types or restate minimal shapes; prefer importing from schema to stay in sync.

### Step 1 — Schema fields + validator (src/identity/schema.ts)
- Add to `ProfessionalOpenQuestion` (267-279): `answer?: string` and `resolved?: boolean`.
- Extend `parseAwareness` open_questions mapper (978-1024): after the `needs_review` spread, add the same optional-spread pattern for `answer` (assertString) and `resolved` (assertBoolean). Mirror existing `...(item.x !== undefined ? { x: assertX(...) } : {})` idiom exactly.
- No migration: additive optional fields (pre-launch posture). Confirm the empty-awareness default at ~636 still type-checks (no change needed).

### Step 2 — Generator (src/utils/identityParametersGeneration.ts)
Mirror `generateAwarenessFromIdentity` (562-599) precisely:
- New `proposeAnswerPatch(identity: ProfessionalIdentityV3, question: ProfessionalOpenQuestion, answerText: string, endpoint: string): Promise<AnswerPatch>`.
- systemPrompt: "You route a candidate's answer into the identity model. Return JSON only." Spell out the response schema (one object with `kind` + kind-specific fields). HARD RULES in prompt: (a) ground every field ONLY in the supplied answer — never invent metrics/numbers/claims the answer does not contain; (b) respect `generator_rules.accuracy` as hard truth; (c) route facts→role-bullet/skill, interpretation→self-model-*; (d) reference existing roleId/groupId from the identity, never fabricate ids.
- User prompt: reuse `buildGenerationPrompt(identity)` (58-75, already includes awareness + generator_rules) and append the specific `question` (topic/description/action) + the user's `answerText`.
- Call `callLlmProxy(endpoint, systemPrompt, userPrompt, { feature: 'research.profile-inference', model: GENERATION_MODEL, timeoutMs: RESEARCH_PROFILE_INFERENCE_TIMEOUT_MS })`.
- Parse with `parseGeneratedPayload(rawResponse, 'Generated answer patch response')`; pass to new `normalizeAnswerPatch(payload, identity)`; wrap errors in the same try/catch (re-throw `JsonExtractionError`, else `Error`).

### Step 3 — normalizeAnswerPatch(payload, identity) (same file, follow normalizeGeneratedVectors style at 94+)
- Read `kind`; switch:
  - `role-bullet`: require non-empty `problem` & `action` & `outcome` (isString.trim); verify `roleId` ∈ `identity.roles`; coerce `impact`/`technologies`/`tags` via `normalizeStringArray`; `metrics` = object of primitive values only, default `{}`. Do NOT mint id here (store mints on apply).
  - `skill`: require non-empty `skillName`; verify `groupId` ∈ `identity.skills.groups`.
  - `self-model-arc`: require non-empty `company` & `chapter`.
  - `competitive-moat`: require non-empty `text`.
  - `unfair-advantage`: `normalizeStringArray(items)`, require ≥1.
  - unknown/missing kind OR unknown roleId/groupId → throw `Error` (surfaces like other generators). Reuse `isString`, `normalizeStringArray`, `removeVoiceTells` (56) for any em-dash scrubbing on free text.

### Step 4 — Tests (extend src/test/identityParametersGeneration.test.ts)
Mock `callLlmProxy` (as existing tests do). Cover:
- each kind normalizes from a well-formed payload;
- unknown `kind` rejected; unknown `roleId`/`groupId` rejected;
- malformed JSON → JsonExtractionError path;
- NO-FABRICATION: answer text with no number yields a role-bullet whose `metrics` is `{}` (assert normalizer strips/ignores any metrics the payload tried to add that aren't grounded — or, if guardrail is prompt-only, assert normalizer at least defaults metrics to {} when absent and document the prompt-level guard). Verify schema round-trips: a question with `answer`/`resolved` passes `parseAwareness`.

### Files touched
- src/identity/schema.ts (type + validator)
- src/types/identity.ts (AnswerPatch)
- src/utils/identityParametersGeneration.ts (generator + normalizer)
- src/test/identityParametersGeneration.test.ts (tests)

### Verification
- `npm run typecheck && npx vitest run src/test/identityParametersGeneration.test.ts`
- `npm run lint` on touched files.
- Build not required for this task (no render wiring) — defer to TASK-280.

### Scope boundary
This task is data + AI ONLY. Do NOT add store actions (TASK-279) or UI (TASK-280). Export `AnswerPatch`, `proposeAnswerPatch`, and `normalizeAnswerPatch` (export the normalizer for direct unit testing) so 279/280 can consume them.

### Open decision for implementer
AC#7 (no-fabrication) can be enforced (a) prompt-only, or (b) prompt + a normalizer that refuses metrics/numbers absent from the answer string. (b) is stronger but heuristic. Recommend: prompt-primary + normalizer defaults `metrics` to `{}` and does not invent; add a focused test asserting absent metrics stay absent. Flag if a stricter cross-check against answerText is wanted.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Regression tests pass (scoped to touched files)
- [ ] #5 Linters report no warnings or errors in touched files
- [ ] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
