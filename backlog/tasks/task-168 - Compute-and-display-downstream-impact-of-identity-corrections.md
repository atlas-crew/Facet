---
id: TASK-168
title: Compute and display downstream impact of identity corrections
status: To Do
assignee: []
created_date: '2026-04-19 10:00'
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
- [ ] #1 After an identity correction, a non-blocking banner shows the number and type of affected downstream artifacts
- [ ] #2 Banner click-through lands on the batch staleness review UI (TASK-158)
- [ ] #3 describeImpact() returns structured DownstreamImpact with per-artifact reasoning
- [ ] #4 Artifacts record the identity fields they depend on (generation time) for field-level impact tracking
- [ ] #5 Fallback to version-only counting when field-level dependencies are absent
- [ ] #6 Works across domains: search theses, search runs, prep decks (cover letters when they ship)
- [ ] #7 Pre-correction preview shows estimated impact (stretch goal, can be AC #8 if separated)
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
