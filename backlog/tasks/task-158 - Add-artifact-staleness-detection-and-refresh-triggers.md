---
id: TASK-158
title: Add artifact staleness detection and refresh triggers
status: In Progress
assignee:
  - '@codex'
created_date: '2026-04-19 06:04'
updated_date: '2026-04-28 15:49'
labels:
  - shepherding
  - staleness
  - refresh
milestone: m-27
dependencies:
  - TASK-151.1
  - TASK-154
references:
  - src/store/identityStore.ts
  - src/store/prepStore.ts
  - src/store/searchStore.ts
documentation:
  - 'backlog doc-26: Cross-Cutting Fresh-Context Critique Triggers'
  - 'backlog doc-26: Dependency Graph'
  - 'backlog doc-21: Discovery 3 Fresh-Context Self-Critique'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When the identity model changes (skill depth corrected, calibration added, vector changed), downstream artifacts (cover letters, prep decks, search thesis) may be stale. Build the detection and refresh mechanism.

**Staleness detection** (start simple):
1. Each generated artifact records which identity model version it was generated from (timestamp or version counter)
2. When the identity model changes, compare artifact versions to current identity version
3. Flag stale artifacts with a non-blocking notification

**Refresh triggers** (doc-26, Cross-Cutting section):
- Skill depth corrected → flag cover letters and prep cards referencing that skill
- New vector added → flag search thesis
- Target vector changed on pipeline entry → flag that entry's cover letter and prep deck
- Significant identity model change → flag all downstream artifacts
- Post-debrief → flag next round's prep deck
- Post-rejection with pattern → flag search thesis lane priorities

**UX for refresh prompts:**
- Non-blocking badge or banner (NOT a modal)
- Batch review: "3 artifacts may be stale. Review?"
- Show diff of what changed and WHY: "your K8s depth correction changed this sentence"
- One-click accept/reject per artifact
- "Refresh" action runs a fresh-context critique pass on the artifact with latest identity context

**Implementation approach:**
- Start with timestamp-based staleness (simple, low risk)
- Add field-level change tracking later (which specific fields changed)
- Start with manual "Refresh" button, add automatic suggestions once detection logic is proven

This is the mechanism that makes corrections feel like progress — the user sees immediate downstream impact from every correction.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Generated artifacts record the identity model version they were created from
- [ ] #2 When identity model changes, stale artifacts are identified by version comparison
- [x] #3 Non-blocking notification surfaces stale artifact count
- [ ] #4 User can review stale artifacts with diff showing what changed and why
- [x] #5 One-click accept/reject per artifact in batch review
- [ ] #6 Refresh action regenerates artifact with latest identity context (fresh-context critique)
- [x] #7 Skill depth correction triggers staleness check on cover letters and prep cards referencing that skill
- [ ] #8 Search thesis flagged as stale when vectors or skill depths change
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-04-28: Added Research batch staleness review opened from the downstream impact notice for skill-depth writeback. The panel snapshots affected search/prep/cover-letter artifacts, shows reasons, supports local accept/not-stale decisions, clears consumed impact notices, and invalidates local decisions with explicit discard counts when Identity is cleared or its revision changes. Refresh regeneration/status persistence remain intentionally disabled and called out in UI/TODO.

Verification: npx vitest run src/test/ResearchPage.test.tsx src/test/artifactMeta.test.ts (78 passed); npm run typecheck (passed); npx eslint src/routes/research/ResearchPage.tsx src/test/ResearchPage.test.tsx src/types/artifactMeta.ts src/test/artifactMeta.test.ts (passed). npm run build is currently blocked by unrelated dirty src/routes/identity/IdentityInspector.tsx errors: unused ProfessionalSkillItem, unused skillNamesMatch, missing SkillGroupInspector, missing SkillItemInspector.

2026-04-28: Added persisted artifact staleness review decisions for TASK-158 batch review. Run, search thesis, prep deck, and cover-letter artifacts now preserve sanitized stalenessReview metadata with decision, reviewed identity revision, artifact identity revision at review, mutation label/fields/revisions, and reason. Batch review decisions save to the owning artifact stores; row status is derived from persisted artifact metadata, guarded by matching mutation fingerprint, and stale/missing artifacts show failure notices instead of optimistic local-only success. Identity-version updates clear stale review metadata only when the artifact advances past the saved review, while explicit fresh review patches are preserved. Refresh generators remain disabled/pending for AC #6. Verification: npx vitest run src/test/ResearchPage.test.tsx src/test/artifactMeta.test.ts src/test/searchStore.test.ts (105 passed); npm run typecheck (passed); touched-file npx eslint for staleness files/tests (passed); npm run build (passed). Independent review: .agents/reviews/review-20260428-113339.md PASS WITH ISSUES, P0/P1=0 with remaining P2/P3 refactor/perf notes. Test audit: .agents/reviews/test-audit-20260428-114245.md identified one ArtifactMeta P1 branch, fixed by not-stale coverage; .agents/reviews/test-audit-20260428-114636.md identified one SearchStore P1 unknown-id branch, fixed by explicit false/no-mutation test. Broad src/test audit was intentionally size-guarded at 2238 KB > 488 KB; stderr /tmp/task158-audit2-err.HnqEKW.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
