---
id: TASK-158
title: Add artifact staleness detection and refresh triggers
status: In Progress
assignee:
  - '@codex'
created_date: '2026-04-19 06:04'
updated_date: '2026-05-07 21:42'
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
- [x] #1 Generated artifacts record the identity model version they were created from
- [x] #2 When identity model changes, stale artifacts are identified by version comparison
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

2026-04-28: Added the first artifact-specific refresh path for TASK-158 batch staleness review: stale saved search theses can now be regenerated from the latest Identity context directly from the batch review. Refresh persists an accepted-current staleness review marker on the regenerated thesis, keeps the previous/current active thesis selection stable, serializes refreshes, and discards generated results if Identity, review context, target artifact presence, or active thesis dirty state changes mid-flight. Non-thesis run/prep/cover-letter refresh remains visibly pending. Coverage added for successful saved-thesis refresh, durable reviewed marker, active dirty-draft blocking, duplicate-refresh serialization, generator failure recovery, and mid-refresh Identity drift discard. Verification: npx vitest run src/test/ResearchPage.test.tsx (69 passed); npm run typecheck (passed); npx eslint src/routes/research/ResearchPage.tsx src/test/ResearchPage.test.tsx (passed); npm run build (passed); npm run test (134 files/1677 tests passed). Review receipts: code review cycles in .agents/reviews/review-20260428-142908.md and .agents/reviews/review-20260428-143207.md drove async guard fixes; test audit .agents/reviews/test-audit-20260428-143639.md identified refresh-guard coverage gaps, with P1 reachable gaps remediated in ResearchPage tests.

2026-05-07 AC #1 closure: Audited all four generated-artifact paths for identityVersion stamping at creation time:
- Thesis: stamped automatically in thesisGenerator.ts:482 from `identity.model_revision`.
- Run: stamped from `thesisSnapshot.identityVersion` in deepSearchClient.ts:196.
- Cover letter: stamped via `resolveLetterIdentityVersion(identity, resume)` helper in LettersPage.tsx:510.
- Prep deck (AI-generated): MISSING — fixed by adding `identityVersion: currentIdentity?.model_revision` to the createDeck call in PrepPage.tsx:1135 (the AI generation path; the manual blank-deck path at PrepPage.tsx:959 is intentionally not stamped because no generation has happened yet).

Regression coverage in src/test/PrepPage.identityGeneration.test.tsx: bumped the fixture's model_revision and the JD analysis fixture's identityVersion from 0 to 3 (matched, so the drift gate doesn't trip), and added an assertion that the AI-generated deck stamps `identityVersion === 3`. Verified the test fails (`expected undefined to be 3`) when the stamping line is removed, confirming it catches regressions mechanically.

Verification: npm run typecheck PASS; npx vitest run src/test/PrepPage.identityGeneration.test.tsx PASS (8/8). Closing AC #1; remaining outstanding ACs (#2, #4, #6, #8) tracked separately.

2026-05-07 AC #2 closure: Added `findStaleArtifacts(currentIdentityVersion, workspace)` cross-store survey helper in src/types/artifactMeta.ts. Given a workspace inventory (theses, runs, prep decks, cover letters), returns the subset whose recorded `identityVersion` is strictly behind current. Coarse signal, pairs with the existing mutation-aware `describeImpact` (field-level) — use `findStaleArtifacts` when you need a workspace-wide survey without a specific mutation in hand.

Gap that motivated the helper: prior to this, version-based identification only happened inside the Research workspace's writeback flow. `isArtifactStale` (per-artifact predicate) had zero production call sites, only tests. There was no cross-store function to answer "given current identity revision, which artifacts are stale?"

Design decisions:
- Artifacts without a recorded `identityVersion` are excluded (no stamp = no comparison possible). AC #1 just closed the stamping gap, so going forward all generated artifacts will be surveyed.
- Output preserves the canonical `IMPACT_TYPE_ORDER` (thesis → run → prep-deck → cover-letter) so downstream UIs render in a stable shape.
- Time-travel guard: artifacts ahead of current (identityVersion > currentVersion) are not flagged — same invariant as `isArtifactStale`.
- Function is pure and store-shape-agnostic (accepts `Array<{id, identityVersion?}>`) so it doesn't pull in store types or create circular imports.

Not wired to any UI surface yet — AC #2 only requires the identification capability. Surface wiring lives under AC #3 (already done for the writeback case) and AC #4 (diff UI, still outstanding).

Test coverage in src/test/artifactMeta.test.ts: 6 new cases covering empty workspace, all-current, mixed (only stale returned), unstamped artifacts excluded, time-travel guard, and canonical type ordering. 24/24 in artifactMeta.test.ts pass.

Verification: npm run typecheck PASS; npx vitest run src/test/artifactMeta.test.ts PASS (24/24).
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
