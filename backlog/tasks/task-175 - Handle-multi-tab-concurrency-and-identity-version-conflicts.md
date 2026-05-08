---
id: TASK-175
title: Handle multi-tab concurrency and identity-version conflicts
status: In Progress
assignee:
  - '@myself'
created_date: '2026-04-19 10:30'
updated_date: '2026-05-08 09:05'
labels:
  - shepherding
  - concurrency
  - cross-cutting
milestone: m-27
dependencies:
  - TASK-159
  - TASK-160
references:
  - src/store/identityStore.ts
  - src/store/searchStore.ts
  - src/store/prepStore.ts
documentation:
  - >-
    backlog doc-26: Shepherding Principles (implicit — no concurrency story
    today)
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Facet runs entirely in the browser with Zustand stores persisted to localStorage. Real users keep multiple tabs open. Concurrent scenarios that have no current design:

1. **Thesis generation in Tab A, identity edit in Tab B** — Thesis was built against identity version N; user mutates identity to N+1 mid-generation. When thesis lands, it's immediately stale.

2. **Deep research job running server-side (TASK-161), user edits identity in any tab** — Phase 2 is running against identity snapshot N; when it completes and hydrates results, identity is N+2. Result's `identityVersion` should reflect the snapshot, not current.

3. **Two tabs simultaneously regenerate prep from the same deck** — Both write to prepStore. localStorage is last-write-wins; user sees whichever tab finishes last.

4. **Debrief entered in Tab A, prep regeneration in Tab B using pre-debrief context** — New prep misses the new debrief data.

5. **Identity version drift across tabs** — Tab A has identity v5 in memory (hasn't received storage events); Tab B writes v6; Tab A writes v5+1=v6 over the top.

**Mitigations:**

### A. Storage-event-driven store sync

Listen for `storage` events on each persisted store key; re-hydrate from localStorage when another tab writes. Zustand's `persist` middleware supports this via `skipHydration: false` + custom sync.

### B. Version-check on identity mutations

On every identity mutation, read current version from localStorage first. If in-memory version < storage version, re-hydrate and ask user to retry. This prevents silent stale writes.

### C. Artifact snapshot on generation start

When generation begins (thesis, prep, letter), snapshot the identity version it's running against. The final artifact records that version. The UI can then flag "this artifact used identity v5; you've since updated to v7 — refresh?" via TASK-158.

### D. Server-side job identity-version check (for TASK-161)

When Phase 2 job completes, compare `ResearchJob.identityVersion` to current client-side identity version. If different, render the result with a badge: "This search ran against an earlier version of your profile. Rerun?"

### E. Soft conflict UI, not hard locks

Don't try to prevent concurrent tabs — too restrictive for real usage. Instead:
- Detect conflicts when they happen
- Surface them non-blockingly ("you have concurrent edits in progress")
- Let the user decide: keep this, switch to that, merge

### F. Toast on cross-tab identity mutation

When a tab detects another tab wrote to the identity store, show a brief toast: "Identity updated in another tab. N artifacts may need refresh." — links to the batch staleness review (TASK-158).

**Out of scope:**
- Operational transforms / CRDT-style merging — Facet's artifacts aren't collaborative editing; last-write-wins is acceptable for single-user-multi-tab
- Offline-first sync — everything's already in localStorage; no remote sync to resolve

**Implementation phases:**
1. Storage-event listeners + re-hydration (fixes scenarios 1, 3, 5) — cheapest win
2. Generation-time snapshot of identity version (fixes scenarios 1, 2) — small change to each generator
3. Version-check on mutation (fixes scenario 5) — pessimistic but rare-collision
4. Conflict UI (toast + resolution) — polish for when conflicts actually happen
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 identityStore, searchStore, prepStore listen for storage events and re-hydrate on cross-tab writes
- [x] #2 Identity mutations check current version from storage before writing; surface conflict if in-memory version is behind
- [x] #3 Generation routines (thesis, prep, letter, research job) snapshot identity version at start; final artifact records that version
- [x] #4 ResearchJob.identityVersion is compared to current client-side identity version on rehydration; staleness badge shown if drift
- [x] #5 Cross-tab identity mutation triggers a non-blocking toast on other tabs
- [x] #6 Toast links to TASK-158 batch staleness review
- [ ] #7 Tests: simulate 2-tab sequence (write in A → observe in B, generation in A while mutation in B, etc.)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lane D plan: implement a narrow first phase for storage-event driven persisted-store rehydration and focused tests, avoiding ResearchPage/result-enrichment files touched by parallel TASK-183/TASK-196 lanes. I will not mark TASK-175 Done unless all AC/DoD are genuinely satisfied.

Lane D progress: implemented storage-event sync for the identity Zustand persistence key and localStorage workspace snapshot rehydration for search/prep runtime state. Added jsdom regression coverage that simulates another tab writing identity, search, and prep state, then observes this tab rehydrate. Remaining TASK-175 ACs cover identity mutation conflict checks, generation snapshot coverage, research-job staleness UI, and toast/TASK-158 links.

Remediation follow-up: tightened storage-event sync typing/behavior, exported the identity storage key for runtime sync, added direct storageEventSync helper coverage, and verified the persistence runtime cross-tab sync tests. Verification: npx vitest run src/test/persistenceRuntime.test.ts src/test/storageEventSync.test.ts passed 29/29; scoped ESLint passed; npm run typecheck passed. TASK-175 remains open for AC #2-#7.

AC #2 advance: current-identity mutations now compare the in-memory model_revision with the persisted identity revision before writing. When storage is newer, the store rehydrates the newer identity, sets a retryable lastError, and skips the attempted stale mutation. Verification: npx vitest run src/test/identityStore.test.ts passed 46/46; focused AC #2 subset passed; scoped ESLint passed; npm run typecheck passed.

AC #3 advance: thesis, prep, cover-letter, and deep-research launch paths now snapshot the identity model revision at generation/launch start and write that revision to the final artifact/run even if Identity changes while the async request is in flight. Added mid-flight drift regressions for ResearchPage thesis + research job, PrepPage deck generation, and LettersPage AI generation. Verification: focused generation-start vitest cases passed; PrepPage.identityGeneration full file passed 9/9; LettersPage full file passed 57/57; ResearchPage focused generation/launch cases passed 2/2; scoped ESLint passed; npm run typecheck passed; npm run build passed. Full ResearchPage suite reached 85/86 with the existing pushes-a-result test timing out under suite load; that exact test passed alone.

AC #5/#6 advance: AppShell now listens for cross-tab identity localStorage writes, shows a non-blocking toast in other tabs when model_revision advances, counts currently stale generated artifacts, and links the toast to /research?review=stale. ResearchPage now treats that route flag as a request to open the existing TASK-158 batch staleness review against stale artifacts for the current Identity revision. Verification: npx vitest run src/test/AppShell.test.tsx --testNamePattern "cross-tab Identity toast" passed; npx vitest run src/test/ResearchPage.test.tsx --testNamePattern "routed stale-review request" passed; scoped ESLint passed; npm run typecheck passed; npm run build passed with existing large-chunk warnings.

AC #4 advance: completed/re-hydrated deep research jobs now keep the last observed job visible for the selected SearchRun after terminal completion, compare ResearchJob.identityVersion to the current Identity model revision, and show an earlier-Identity warning with a preserved-thesis rerun action when drift is detected. Verification: npx vitest run src/test/ResearchPage.test.tsx -t "passes excluded companies into launched searches" --testTimeout=15000 passed; scoped ESLint passed; npm run typecheck passed; npm run build passed with existing large chunk warnings.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
