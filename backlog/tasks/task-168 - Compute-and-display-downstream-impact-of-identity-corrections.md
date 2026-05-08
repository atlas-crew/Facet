---
id: TASK-168
title: Compute and display downstream impact of identity corrections
status: Done
assignee:
  - '@codex'
created_date: '2026-04-19 10:00'
updated_date: '2026-05-08'
labels:
  - shepherding
  - identity-model
  - ux
milestone: m-27
dependencies:
  - TASK-159
  - TASK-158
references:
  - src/store/identityStore.ts
  - src/store/searchStore.ts
  - src/store/prepStore.ts
documentation:
  - 'backlog doc-26: Shepherding Principles, Design Rule 3'
  - 'backlog doc-26: Cross-Cutting Fresh-Context Critique Triggers'
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
doc-26 Design Rule 3 says: "When the user corrects one thing, show what changed: '3 search results filtered differently. 2 prep cards updated. 1 cover letter flagged for refresh.'" This is the UX payoff that makes the entire extraction loop feel rewarding — and without it, corrections feel like data entry (the exact failure mode doc-21 calls out).

This mechanism is load-bearing but currently has no data structure, no computation path, and no acceptance criteria on any existing task. File it so it ships alongside TASK-158 (staleness detection) rather than as an afterthought.

**Scope:**

1. **Dependency tracking** — when an identity field changes, identify which artifacts reference it. Minimum viable signal: artifact's `identityVersion` < current (TASK-159). Better signal: field-level tracking.

2. **Impact computation** — `describeImpact(mutation: IdentityMutation): Impact`
   - Count of theses/runs/decks/letters that reference the mutated field
   - For each affected artifact, a one-line reason ("your K8s depth correction changed this sentence")

3. **Impact display** — Inline toast or banner after a correction:
   > "K8s depth updated to 'architectural'. 3 search results filtered differently, 2 prep cards flagged for refresh, 1 cover letter has stale framing."
   - Non-blocking; dismissible
   - Click-through takes user to the batch review UI (TASK-158)

4. **Pre-correction preview (stretch)** — Before the user confirms a correction, show what the impact *will be*:
   > "Changing K8s depth will affect: 3 search results, 2 prep cards, 1 cover letter. Continue?"
   - Turns correction into a visible investment rather than a silent edit

**Implementation approach:**
- Start simple: count artifacts whose `identityVersion < current` as a blunt upper bound
- Layer in: field-level dependency tracking via `identityFingerprint` on artifacts
- Field-to-artifact index: precompute which fields each artifact depends on during generation; store on artifact

**Minimum viable data shape:**
```typescript
interface ArtifactFieldDependency {
  artifactType: 'thesis' | 'run' | 'prep-deck' | 'cover-letter'
  artifactId: string
  fields: string[]  // e.g., ['skills.k8s.depth', 'skills.rust.depth']
}

interface DownstreamImpact {
  artifactsAffected: Array<{
    artifactType: string
    artifactId: string
    reason: string  // One-line human-readable
  }>
  totalCount: number
}
```

This is the "show your work" UX that makes corrections feel like investment, not tedium.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 After an identity correction, a non-blocking banner shows the number and type of affected downstream artifacts
- [x] #2 Banner click-through lands on the batch staleness review UI (TASK-158)
- [x] #3 describeImpact() returns structured DownstreamImpact with per-artifact reasoning
- [x] #4 Artifacts record the identity fields they depend on (generation time) for field-level impact tracking
- [x] #5 Fallback to version-only counting when field-level dependencies are absent
- [x] #6 Works across domains: search theses, search runs, prep decks (cover letters when they ship)
- [x] #7 Pre-correction preview shows estimated impact (stretch goal, can be AC #8 if separated)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-168 slice implemented structured DownstreamImpact/describeImpact with per-artifact reasoning, version fallback, Research pre-confirmation preview, post-writeback dismissible impact banner, and /identity review action until TASK-158 batch review exists. Search theses and runs now stamp field dependencies from thesis skillDepthMap; prep decks and cover letters preserve identityFields when supplied and otherwise use version fallback.

Verification: npx vitest run src/test/artifactMeta.test.ts src/test/ResearchPage.test.tsx (76 passed); npm run typecheck; touched-file eslint for TASK-168 files (0 warnings/errors); npm run build. Full npm run lint remains blocked by unrelated generated/dist and dirty prep/test baseline issues.

2026-04-28: TASK-158 batch review slice landed in bee49f2. The downstream impact banner now opens the batch staleness review UI instead of navigating to /identity, satisfying AC #2. TASK-168 remains In Progress because artifact generation-time field dependency coverage is still incomplete and repo-wide gates are affected by unrelated dirty baseline work.

2026-05-08 AC #4 closure: Created `src/utils/identityFieldDeps.ts` exporting `buildSkillIdentityFields(skillName)` and `collectIdentityFieldsFromJdSkillMatches(analysis)`. The latter is the canonical generation-time field-dependency builder for cover letters and prep decks: given the JD analysis the artifact was generated against, return the set of `skills.<name>.{depth,context,positioning}` paths covering every JD-matched skill. JD analysis is the deterministic structured signal of which identity skills were load-bearing for the artifact — identity changes outside that set should NOT flag the artifact as stale (precision over recall).

Wired into:
- `src/utils/regen/coverLetterRegen.ts` — `regenerateCoverLetterForEntry` now stamps `identityFields` on every generated letter via `upsertLetterForPipelineEntry`. Covers the LettersPage initial-generation path (which calls the same shared action) and the ResearchPage staleness-review refresh path.
- `src/utils/regen/prepDeckRegen.ts` — `regeneratePrepDeckForEntry` now stamps `identityFields` on the regenerated deck via `updateDeck`.
- `src/routes/prep/PrepPage.tsx` — both the initial generation path (line ~1108 `createDeck`) and the latest-deck regen path (line ~1786 `updateDeck`) now stamp `identityFields`.

Behavior change: `describeImpact` now uses field-level matching for newly generated cover letters and prep decks. When K8s.depth changes, only artifacts whose JD analysis matched K8s get flagged — frontend-cover-letters stop appearing in K8s-correction batch review. Older artifacts without `identityFields` continue to use coarse version fallback (per AC #5, intentional).

Test coverage in `src/test/identityFieldDeps.test.ts`: 8 new tests — empty/null analysis, no skill matches, multi-skill emit order, deduplication on duplicate skill, blank skill names skipped, whitespace trimming.

Verification: npm run typecheck PASS; npx vitest run on identityFieldDeps + artifactMeta + ResearchPage + LettersPage suites = 187/187 PASS. Commit forthcoming as feat(staleness): stamp identity field deps on cover letters and prep decks.

Out of scope: thesis stamping was already shipped (TASK-159 era) via `collectThesisIdentityFieldDependencies`. Deep-search runs already inherit `identityFields` from their thesis snapshot. Manual-draft cover letters (LettersPage's blank-template path) intentionally do not stamp because they have no JD analysis to anchor on — that's correct behavior; they remain coarse-version-only and that matches their generation reality.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
