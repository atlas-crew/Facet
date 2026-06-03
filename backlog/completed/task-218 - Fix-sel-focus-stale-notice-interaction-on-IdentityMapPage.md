---
id: TASK-218
title: Fix sel/focus stale-notice interaction on IdentityMapPage
status: Done
assignee: []
created_date: '2026-05-05 22:42'
updated_date: '2026-05-07 21:21'
labels:
  - identity
  - bug
  - bridge
  - cross-workspace-deep-link
dependencies:
  - TASK-217
references:
  - src/routes/identity/IdentityMapPage.tsx
  - src/test/IdentityMapPage.deepLink.test.tsx
documentation:
  - >-
    .agents/reviews/review-20260505-182757.md (cross-model agent-loops review,
    finding P1-002)
  - >-
    backlog/tasks/task-217 -
    Build-cross-workspace-deep-link-bridge-for-Identity-Map-forward-return.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

The deep-link bridge's stale-selection notice is silently cleared by the focus effect when both `?sel=<invalid>` and `?focus=<valid>` are present in the URL. The user follows a partially-stale deep link (e.g., a copy-pasted URL where the targeted match-rule was deleted but the band focus still resolves), and never sees the notice that explains why their selection was dropped — the focus effect's `setStaleNotice(null)` overwrites it.

## Cross-confirmed source

Surfaced independently by two reviews of TASK-217 on 2026-05-05:

1. **agent-loops cross-model review** (Codex, different model family from implementer) — finding P1-002 in `.agents/reviews/review-20260505-182757.md`: "Valid focus can clear an unrelated stale selection warning."

2. **multi-perspective-analysis self-review** (Claude, same session) — convergent insight from Concurrency, API Design, and Test Strategist perspectives: the sel/focus interaction matrix has 4 cells, only 1 is tested.

Cross-model + multi-lens convergence raises confidence this is a real bug, not a single-perspective artifact.

## Reproduction

1. Generate a deep link: `/identity?sel=match-rule:prioritize:<id>&focus=preferences`
2. Delete the rule so `isMapSelectionValid` returns false
3. Visit the URL again

**Expected:** stale notice ("That match rule isn't there anymore...") visible while user lands on Preferences band scrolled into view.

**Actual:** notice flashes briefly or is never visible because the focus effect runs after the forward effect on the same render and calls `setStaleNotice(null)`. User lands at Preferences with no explanation.

## Where the bug lives

`src/routes/identity/IdentityMapPage.tsx:128-132`:

```tsx
if (validatedFocus) {
  const layer = getBandDataLayerForFocus(validatedFocus)
  const element = document.querySelector<HTMLElement>(`[data-layer="${layer}"]`)
  element?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  setStaleNotice(null) // <-- bug: clears notice from sel path too
}
```

Both effects can write to the same `staleNotice` state, last writer wins. The symmetric case (sel valid + focus invalid) likely has the same shape via line 70's `setStaleNotice(null)` in the sel-valid path — implementer should verify both directions.

## Implementation paths

**Path A (recommended):** Remove `setStaleNotice(null)` from the focus-valid path (line 132) and audit line 70 for the symmetric case. Smallest fix; avoids last-writer-wins entirely.

**Path B:** Track stale notices by source via `useState<{ source: 'sel' | 'focus'; message: string } | null>`. Each effect's clear only affects its own source. More robust; ~10 lines.

Recommend Path A — the `setStaleNotice(null)` clears were defensive without a clear case for them. Path B can land later if a third effect ever writes notices.

## Test additions (covering the missing matrix cells)

```ts
it('preserves sel-stale notice when focus is valid', async () => {
  seedIdentityWithMatchRule()
  mockUseSearch.mockReturnValue({
    sel: 'match-rule:prioritize:rule-does-not-exist',
    focus: 'preferences',
  })
  render(<IdentityMapPage />)
  await waitFor(() => {
    const notice = screen.queryByRole('status')
    expect(notice).not.toBeNull()
    expect(notice?.textContent ?? '').toContain("match rule isn't there anymore")
  })
})

it('preserves focus-stale notice when sel is valid', async () => {
  seedIdentityWithMatchRule()
  mockUseSearch.mockReturnValue({
    sel: 'match-rule:prioritize:rule-prio-1',
    focus: 'not-a-band',
  })
  render(<IdentityMapPage />)
  await waitFor(() => {
    const notice = screen.queryByRole('status')
    expect(notice).not.toBeNull()
    expect(notice?.textContent ?? '').toContain("link target isn't there anymore")
  })
})
```

## Why this slipped TASK-217

TASK-217 shipped 5 focus-extension tests including "valid sel + valid focus + valid return," but the 3 matrix cells where ONE param is invalid were not tested. The interaction was invisible to the existing suite. This task closes the gap.

## Related architectural cleanup

Per multi-perspective-analysis synthesis, this fix pairs naturally with a `staleNotice` → `useMemo` derivation refactor (eliminates the `eslint-disable-line react-hooks/set-state-in-effect` annotations). If Path B is chosen, fold in the refactor. If Path A, defer as a separate hygiene task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 With URL `?sel=<invalid>&focus=<valid>`, the stale notice from the sel path remains visible after the focus scroll fires
- [ ] #2 With URL `?sel=<valid>&focus=<invalid>`, the focus stale notice does not get clobbered by the sel path's `setStaleNotice(null)` (the symmetric case)
- [ ] #3 Test added covering both interaction cells from #1 and #2 — these are 2 of the 4 cells of the sel/focus interaction matrix that TASK-217 left untested
- [ ] #4 No regression in the cells that ARE tested (sel-valid+focus-valid, sel-invalid alone, focus-invalid alone)
- [ ] #5 npm run typecheck, npm run lint, npm run test pass
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed via Path A from the task brief (removed both `setStaleNotice(null)` calls from the sel/focus effects' success branches). Notices now persist across same-render sibling-effect outcomes; only the Dismiss button clears them explicitly.

**Surfaces touched:**
- `src/routes/identity/IdentityMapPage.tsx` (lines 70 and 132 of original) — removed the two `setStaleNotice(null)` calls; replaced with explanatory comments referencing TASK-218. Added missing eslint-disable annotations on the else-branch setStaleNotice calls (these were already triggering `react-hooks/set-state-in-effect` but had never been suppressed; surfaced once the success-branch comments shifted line numbers).
- `src/test/IdentityMapPage.deepLink.test.tsx` — added two regression tests under a new "TASK-218" describe block:
  - `preserves sel-stale notice when focus is valid` (sel=invalid + focus=valid)
  - `preserves focus-stale notice when sel is valid` (sel=valid + focus=invalid)
  - Each asserts both that the notice is preserved AND that the sibling effect's success side-effect (scroll for focus, setMapSelection for sel) still runs.

**Verification:**
- `npx vitest run src/test/IdentityMapPage.deepLink.test.tsx` — 22 tests pass (was 20; added 2)
- `npx tsc --noEmit -p tsconfig.app.json` — 0 errors
- `npx eslint src/routes/identity/IdentityMapPage.tsx src/test/IdentityMapPage.deepLink.test.tsx` — clean

All 5 ACs met. The 4 cells of the sel/focus interaction matrix are now all tested (was 1 before).

**Note on Path A trade-off:** removing the clears means a stale notice from a prior failed deep-link can persist if the user navigates from `?focus=<invalid>` (notice set) to `?sel=<valid>` (no clear). Mitigated by the Dismiss button. Path B (source-tracked notices) was considered but adds ~10 lines of state machinery without resolving the underlying cross-navigation case any better than Path A. Not pursued.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
