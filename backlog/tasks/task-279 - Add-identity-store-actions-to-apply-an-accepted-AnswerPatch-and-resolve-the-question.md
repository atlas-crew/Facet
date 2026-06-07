---
id: TASK-279
title: >-
  Add identity store actions to apply an accepted AnswerPatch and resolve the
  question
status: To Do
assignee: []
created_date: '2026-06-05 17:14'
updated_date: '2026-06-07 01:37'
labels: []
milestone: m-34
dependencies:
  - TASK-278
references:
  - 'src/store/identityStore.ts:1587'
  - 'src/store/identityStore.ts:1509'
  - 'src/store/identityStore.ts:1682'
documentation:
  - >-
    specs/answerable-identity-open-questions/doc-45 -
    Answerable-Identity-Open-Questions-—-Design.md
priority: medium
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
State layer for the answerable-open-questions flow. Adds the store action that records a question's answer and resolution, and a patch-apply helper that routes an accepted AnswerPatch (from task 278) to the EXISTING identity write-back actions — no new write surfaces invented.

WHY: The inspector UI (task 3) needs a single, tested store entry point to (a) apply the user-accepted patch to the correct identity layer and (b) mark the question resolved. Keeping this in the store keeps the immutable-update discipline and write-back routing in one place.

Provided by task 278: the AnswerPatch discriminated union and the answer?/resolved? schema fields.

Routing (see doc-45): role-bullet → append via updateCurrentRoles; skill → addSkillToCurrentIdentity; self-model targets → updateCurrentSelfModelArc / updateCurrentCompetitiveMoat / updateCurrentUnfairAdvantages. All exist in src/store/identityStore.ts. resolveAwarenessQuestion(id, answer) sets answer + resolved:true via the existing updateCurrentAwarenessQuestions replace pattern (identityStore.ts:1587-1595). Updates must be immutable (spread/map), per repo store conventions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A store action resolveAwarenessQuestion(id, answer) sets answer and resolved:true on the matching question immutably, leaving other questions untouched
- [ ] #2 A patch-apply path takes an accepted AnswerPatch and dispatches to the correct existing write-back: role-bullet appends a bullet to the named role; skill adds via addSkillToCurrentIdentity; self-model kinds call the matching self-model action
- [ ] #3 Applying a role-bullet patch preserves all existing roles and bullets and only appends the new bullet to the targeted role
- [ ] #4 Applying a patch whose target id no longer exists is a safe no-op (or surfaces a recoverable error) rather than corrupting state
- [ ] #5 All mutations are immutable (no in-place mutation of store arrays/objects)
- [ ] #6 Tests cover each patch kind routing to the right write-back, the resolve action, and the missing-target safe path
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan (grounded in current code)

Prerequisite: TASK-278 must land first — it exports `AnswerPatch` (from src/types/identity.ts) and the `answer?`/`resolved?` schema fields this task writes.

### Store mechanics confirmed
- `updateCurrentIdentity(state, updater)` helper (src/store/identityStore.ts:710) is the standard mutation wrapper — bumps revision + syncs the document. Most actions use it.
- `syncIdentityDocument(state, nextIdentity)` (575) is the lower-level variant used when an action builds `nextIdentity` by hand (see addSkillToCurrentIdentity 1682-1724).
- Existing write-backs to reuse (do NOT reimplement their bodies):
  - roles: `updateCurrentRoles(value)` (1509-1515) — bulk replace.
  - skills: `addSkillToCurrentIdentity(groupId, skillName)` (1682-1724) — already dedupes via skillNamesMatch and is a safe no-op for unknown groupId (map skips).
  - self-model: `updateCurrentSelfModelArc(value)` (1472), `updateCurrentCompetitiveMoat(value)` (1482), `updateCurrentUnfairAdvantages(value)` (1495).
- Id minting: use `createId('bullet')` for the new `ProfessionalRoleBullet.id` (createId already used with ad-hoc prefixes, e.g. createId('search-vector') at 1767).

### Step 1 — Action declarations (interface block ~139-174)
Add two method signatures near the existing identity-mutation declarations:
- `resolveAwarenessQuestion: (id: string, answer: string) => void` (after line 153, beside updateCurrentAwarenessQuestions).
- `applyAnswerPatch: (patch: AnswerPatch) => void`.
Import `AnswerPatch` from '../types/identity' at the top of the store.

### Step 2 — resolveAwarenessQuestion (implement near updateCurrentAwarenessQuestions 1587)
```
resolveAwarenessQuestion: (id, answer) =>
  set((state) => updateCurrentIdentity(state, (identity) => ({
    ...identity,
    awareness: {
      open_questions: (identity.awareness?.open_questions ?? []).map((q) =>
        q.id === id ? { ...q, answer: answer.trim(), resolved: true } : q),
    },
  }))),
```
Immutable map; other questions untouched. If answer is empty after trim, still set resolved:true but omit answer (mirror the optional-field idiom).

### Step 3 — applyAnswerPatch (implement alongside; delegate to existing actions via get())
Switch on `patch.kind` and reuse existing actions so dedupe/revision logic stays in one place:
- `role-bullet`: read `get().currentIdentity?.roles`; if no role matches `patch.roleId` → no-op return. Else build a full `ProfessionalRoleBullet`:
  `{ id: createId('bullet'), problem, action, outcome, impact: patch.bullet.impact ?? [], metrics: patch.bullet.metrics ?? {}, technologies: patch.bullet.technologies ?? [], tags: patch.bullet.tags ?? [] }`
  then `get().updateCurrentRoles(roles.map(r => r.id === patch.roleId ? { ...r, bullets: [...r.bullets, newBullet] } : r))`.
- `skill`: `get().addSkillToCurrentIdentity(patch.groupId, patch.skillName)` (already safe for unknown group).
- `self-model-arc`: `get().updateCurrentSelfModelArc([...(currentIdentity.self_model.arc ?? []), patch.entry])`.
- `competitive-moat`: `get().updateCurrentCompetitiveMoat(patch.text)`.
- `unfair-advantage`: merge with existing — `get().updateCurrentUnfairAdvantages([...(self_model.unfair_advantages ?? []), ...patch.items])` (the action trims + the schema dedupe at hydration handles repeats; if a runtime dedupe util exists — dedupeUnfairAdvantages in src/utils/unfairAdvantagesDedupe — apply it before calling).
- default/unknown kind: no-op (TypeScript exhaustiveness — use a `never` assertion so a new kind forces a compile error).

NOTE: applyAnswerPatch uses `set`-free orchestration (calls other actions), so each delegated action performs its own revision bump. That is acceptable (one patch = one logical mutation). Do not wrap in an outer set().

### Step 4 — Tests
Add a focused suite (e.g. src/test/identityStoreAnswerPatch.test.ts; follow the existing identity store test setup — see IdentityMapEditing.test.tsx for store-init patterns). Cover:
- resolveAwarenessQuestion sets answer+resolved on the target only, immutably (assert other questions unchanged, original array not mutated).
- each patch kind routes correctly: role-bullet appends exactly one bullet to the named role and preserves all other roles/bullets; skill adds via the group; each self-model kind updates its field.
- missing-target safe path: role-bullet with unknown roleId is a no-op (roles unchanged); skill with unknown groupId is a no-op.
- immutability: original state arrays are not mutated in place.

### Files touched
- src/store/identityStore.ts (declarations + 2 actions)
- src/test/identityStoreAnswerPatch.test.ts (new)

### Verification
- `npm run typecheck && npx vitest run src/test/identityStoreAnswerPatch.test.ts`
- `npm run lint` on touched files.

### Scope boundary
State layer only. No generator (278), no UI (280). Export nothing new beyond the store actions (consumed by 280 via the useIdentityStore hook).
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
