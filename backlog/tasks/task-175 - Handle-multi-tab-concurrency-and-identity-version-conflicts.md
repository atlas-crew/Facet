---
id: TASK-175
title: Handle multi-tab concurrency and identity-version conflicts
status: To Do
assignee: []
created_date: '2026-04-19 10:30'
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
  - 'backlog doc-26: Shepherding Principles (implicit — no concurrency story today)'
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
- [ ] #1 identityStore, searchStore, prepStore listen for storage events and re-hydrate on cross-tab writes
- [ ] #2 Identity mutations check current version from storage before writing; surface conflict if in-memory version is behind
- [ ] #3 Generation routines (thesis, prep, letter, research job) snapshot identity version at start; final artifact records that version
- [ ] #4 ResearchJob.identityVersion is compared to current client-side identity version on rehydration; staleness badge shown if drift
- [ ] #5 Cross-tab identity mutation triggers a non-blocking toast on other tabs
- [ ] #6 Toast links to TASK-158 batch staleness review
- [ ] #7 Tests: simulate 2-tab sequence (write in A → observe in B, generation in A while mutation in B, etc.)
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
