---
id: doc-45
title: Answerable Identity Open Questions — Design
type: specification
created_date: '2026-06-05 17:14'
tags:
  - identity
  - awareness
  - llm
  - architecture
---
# Answerable Identity Open Questions — Design

Milestone: **m-34 — Answerable Identity Open Questions**

## Context

On the Identity Map, the awareness builder generates **open questions** — gaps the
candidate should close to improve positioning (e.g. "What scale of systems did you
operate?"). The generation + review editor shipped in TASK-102.5. But the loop is
open: a user can read a question, edit the question text, toggle `needs_review`, or
delete it — there is **no way to answer a question and have that answer update the
identity model**.

This milestone closes the loop with an **AI-assisted propose-and-accept** flow:
the user answers in free text, an LLM proposes a concrete, layer-correct patch to
the identity, and the user accepts / edits / skips it. Accepting applies the patch
and marks the question resolved.

## Current state (verified)

- Type: `ProfessionalOpenQuestion` — `src/identity/schema.ts:267-279`. Fields:
  `id, topic, description, action, severity?, evidence?, needs_review?`. **No
  `answer`/`resolved` field.**
- Hydration validator for questions — `src/identity/schema.ts:983-1018`.
- Generator: `generateAwarenessFromIdentity` — `src/utils/identityParametersGeneration.ts:562-599`
  (produces questions; does not consume answers).
- Store write surface for questions: `updateCurrentAwarenessQuestions` —
  `src/store/identityStore.ts:1587-1595` (bulk-replaces the array).
- Inspector: `src/routes/identity/inspectorSlots/AwarenessQuestionInspector.tsx`
  — only Edit / Mark-reviewed / Remove. No answer affordance.
- Inspector dispatch: `src/routes/identity/IdentityInspector.tsx` routes
  `selection.type === 'awareness-question'`.

## Why not reuse the proposed-vectors flow as-is

TASK-263's propose-and-accept (`ProposedVectorsCard.tsx`, `acceptProposedVector` at
`src/store/identityStore.ts:1748-1845`) stores proposals on `state.draft`
(`IdentityExtractionDraft`, `src/types/identity.ts:64-77`) — which only exists during
the **import/bootstrap** flow, and `acceptProposedVector` mutates `draft.identity`,
not the live identity. Answering an open question happens on the **live, already-applied
identity**, where there is no draft. We reuse the **interaction shape**
(propose → review → accept/edit/skip) but hold the pending proposal in **ephemeral
inspector state**, not persisted draft state. Once accepted it becomes real identity
data; if the user reloads before accepting, they simply re-answer.

## Architecture-guard compliance

- **Evidence vs. narrative (commitment #3):** the proposed patch is a discriminated
  union over the target layer. Facts route to evidence (`roles[].bullets`,
  `skills`); interpretation routes to narrative (Self Model). This is **not** the
  forbidden auto-derivation of narrative from evidence — the *user authors* the
  answer; the LLM only routes and phrases user-provided content.
- **Identity is canonical (commitment #1):** answers write into identity (canonical).
  The generator prompt pins the model to the user's answer as ground truth — it must
  **not invent metrics or claims** the user did not supply — and honors
  `generator_rules.accuracy`. Echoes the AI-inference-vs-user-input rule: a
  confidently-wrong fabricated bullet is worse than none.
- **Pre-launch posture (commitment #5):** schema fields added directly; additive
  optional fields, no migration.

## Design

### Schema (data layer)
Add to `ProfessionalOpenQuestion`:
- `answer?: string` — the user's free-text answer, retained as provenance.
- `resolved?: boolean` — set true when an accepted patch is applied (distinct from
  `needs_review`, which means "a human eyeballed it").

Extend the validator at `src/identity/schema.ts:983-1018` to parse both (optional).

### AnswerPatch type + generator (AI layer)
New discriminated union (in `src/types/identity.ts` or alongside the generator):

```
type AnswerPatch =
  | { kind: 'role-bullet'; roleId: string; text: string }
  | { kind: 'skill'; groupId: string; skillName: string }
  | { kind: 'self-model-arc'; entry: ProfessionalIdentityArcEntry }
  | { kind: 'competitive-moat'; text: string }
  | { kind: 'unfair-advantage'; items: string[] }
```

New generator `proposeAnswerPatch(identity, question, answerText, endpoint)` mirroring
the existing `callLlmProxy → parseGeneratedPayload → normalize` pattern
(`identityParametersGeneration.ts`). The model receives the question + the user's
answer + the identity, decides the target layer, and returns one patch grounded only
in the answer. Normalizer validates the discriminant and that referenced ids exist.

### Store (state layer)
- `resolveAwarenessQuestion(id, answer)` — sets `answer` + `resolved: true` on the
  question via the existing replace action.
- A patch-apply helper that routes an accepted `AnswerPatch` to existing write-backs:
  `updateCurrentRoles` (append bullet), `addSkillToCurrentIdentity`,
  `updateCurrentSelfModelArc` / `updateCurrentCompetitiveMoat` /
  `updateCurrentUnfairAdvantages`. No new write surfaces invented.

### UI (presentation layer)
Extend `AwarenessQuestionInspector.tsx`:
- Answer textarea + "Propose update" button → calls `proposeAnswerPatch`, holds the
  returned patch in `useState`.
- Proposal card showing the human-readable target ("Add bullet to <role>") with
  **Accept / Edit / Skip**.
- Accept → apply patch via store + `resolveAwarenessQuestion` → question renders as
  resolved.
- After apply, optionally surface `describeImpact` (`src/types/artifactMeta.ts:329`)
  so the user sees downstream artifacts that may need refresh.

## Task breakdown (sequential, one PR each)

1. **Schema + AnswerPatch type + `proposeAnswerPatch` generator** (data + AI). Tests:
   generator normalization, id-existence validation, no-fabrication guardrail.
2. **Store apply + resolve actions** (state). Depends on #1. Tests: each patch kind
   routes to the right write-back; resolve sets answer/resolved immutably.
3. **Inspector answer → propose → accept/edit/skip UI** (presentation). Depends on
   #1 + #2. Tests: full flow, skip path, resolved rendering, error path.

## Verification

- `npm run typecheck && npm run test` after each task.
- `npm run build` after task 3 (UI/render wiring).
- Manual: `npm run dev` → Identity Map → select an open question → answer →
  propose → accept → confirm the model field updated and the question shows resolved.
