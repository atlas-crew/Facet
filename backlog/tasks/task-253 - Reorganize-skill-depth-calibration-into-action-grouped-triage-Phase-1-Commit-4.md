---
id: TASK-253
title: >-
  Reorganize skill-depth calibration into action-grouped triage (Phase 1, Commit
  4)
status: In Progress
assignee:
  - Nicholas Ferguson
created_date: '2026-05-10 16:25'
updated_date: '2026-05-11 06:29'
labels:
  - research
  - phase-1-cull
  - ux-restructure
milestone: m-31
dependencies: []
references:
  - docs/audits/2026-05-10/report.md
modified_files:
  - src/routes/research/ResearchPage.tsx
  - src/routes/research/research.css
  - src/test/ResearchPage.test.tsx
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Goal

Replace the current linear `skillDepthMap` rendering in the research workspace with three action-grouped sections so the user can triage skill-depth calibrations by what action they need.

Commit 4 of the Research Workspace Phase 1 cull plan. Independent of Commit 3 (cull dead surfaces) — can land before, after, or in parallel.

## Current state

Linear list of all `thesisDraft.skillDepthMap` entries at `src/routes/research/ResearchPage.tsx:3792-3850` (region — verify exact lines after Commit 3 lands). Every skill calibration is rendered as one row regardless of whether it's a depth change, a confirmed match, or a newly-surfaced skill.

## Target state — three action-grouped sections

| Group | Rendering | Default expansion |
|---|---|---|
| **Depth changes proposed** | Per-entry row with review/confirm/reject affordances; drives the writeback flow | Expanded |
| **Depths confirmed** | Per-entry row, compact; no actionable controls | Collapsed |
| **New skills surfaced** | Per-entry row with review/accept affordances; promotes additions to identity | Expanded |

## Locked decisions (do not re-litigate)

- **Empty groups render with explanatory copy**, not hidden. The user learns the group exists even when empty. Default-collapsed for "depths confirmed" still applies. Suggested copy:
  - Depth changes proposed (empty): "No depth changes proposed. The thesis depths match your identity."
  - Depths confirmed (empty): "No confirmed depths yet."
  - New skills surfaced (empty): "No new skills surfaced. The thesis stayed within your identity skill set."

## Group categorization logic

For each `entry` in `thesisDraft.skillDepthMap`:

1. Find the matching identity skill via `entry.skill` (use `skillNamesMatch` or `normalizeSkillKey` for case-insensitive matching against identity skill names + aliases).
2. If no match exists in identity → **"new skills surfaced"**.
3. If match exists and `entry.depth === identitySkill.depth` → **"depths confirmed"**.
4. If match exists and `entry.depth !== identitySkill.depth` → **"depth changes proposed"**.

Implement as a `useMemo` over `(thesisDraft.skillDepthMap, currentIdentity?.skills)` returning a tuple `{ proposed, confirmed, surfaced }`.

## CRITICAL: do NOT touch the writeback semantics

The writeback flow (`handleRequestSkillDepthWriteback`, `pendingSkillWriteback`, the `identityRevision` concurrency guard at `ResearchPage.tsx:843-861`) is correct and must be preserved unchanged. Only the rendering layer changes.

Specifically preserve:
- `pendingSkillWriteback.identityRevision` check that cancels writeback if identity changed underneath
- The "Identity changed after confirmation opened" notice
- `buildSkillDepthValueChanges`, `buildSkillDepthMutation`, `describeImpact` and the downstream impact display
- The `pendingSkillWriteback` state machine and resolution flow

## Out of scope

- Adding a "bulk accept all proposed changes" affordance (Phase 2 if needed)
- Changing the writeback concurrency model (out of scope)
- Adding undo/redo for accepted depths (Phase 2 if needed)

## Verification

- `npm run typecheck` passes
- `npx vitest run src/test/ResearchPage.test.tsx` passes; existing skill-writeback tests still cover the unchanged semantics
- Manual smoke: 
  - Generate a thesis whose `skillDepthMap` has at least one entry per group (depth-changed, confirmed, new); verify all three groups render with correct counts.
  - Confirm an "depth changes proposed" entry; verify writeback fires and concurrency guard still works (mutate identity in another tab; the cancellation notice should appear).
  - Verify "depths confirmed" group is collapsed by default; expand it; entries render compactly without action controls.
  - Verify empty-state copy renders for any group with zero entries.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Three action-grouped sections render: depth changes proposed (expanded by default), depths confirmed (collapsed by default), new skills surfaced (expanded by default)
- [x] #2 Group categorization logic uses identity skill matching (skillNamesMatch or normalizeSkillKey) and correctly assigns each skillDepthMap entry to one group
- [x] #3 Empty groups render with explanatory copy, not hidden
- [x] #4 Writeback flow (handleRequestSkillDepthWriteback, pendingSkillWriteback, identityRevision guard at ResearchPage.tsx:843-861) is unchanged; existing tests still pass without modification
- [x] #5 Group counts in section headers reflect entry counts accurately
- [x] #6 npm run typecheck passes; npx vitest run passes
- [ ] #7 Manual smoke verifies all four scenarios: mixed-group thesis, confirm flow, concurrency guard, empty-state copy
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation plan (approved scope: Commit 4 only)

### Current state, verified
- Commit 3 (cull dead surfaces) landed in 536322f. Skill-depth calibration now renders at `src/routes/research/ResearchPage.tsx:3513-3598` (not 3792-3850).
- Writeback flow is `handleRequestSkillDepthWriteback` (line 2149) → `pendingSkillWriteback` state → confirmation modal at line 3121. Concurrency guard is at lines 826-843. None of this code will change.
- `buildSkillDepthValueChanges` (line 271) scans `identity.skills.groups[].items` for a name match via `skillNamesMatch` and bails when there is no match, so "writeback" cannot create new identity skills today.

### Categorization helper
- New `useMemo` over `(thesisDraft.skillDepthMap, currentIdentity?.skills.groups)`.
- Flatten identity skills once into a lookup keyed by normalized name; reuse `skillNamesMatch` for the same case-insensitive semantics writeback uses.
- Return `{ proposed, confirmed, surfaced }` where each element is `{ entry, index }` so existing `handleRequestSkillDepthWriteback(index)` keeps targeting the canonical `skillDepthMap[index]`.
- Categorization rule: no identity match → `surfaced`; match + same depth → `confirmed`; match + different depth → `proposed`.

### Section rendering (replace lines 3513-3598)
- Three `<section>`s wrapped in `<details open>` (`true` for proposed/surfaced, `false` for confirmed). Native `<details>` keeps a11y free and matches the existing pattern at lines 4090, 4237.
- Each `<summary>` shows the group title and entry count.
- Empty groups still render the `<details>` with the prescribed copy in the body:
  - Proposed (empty): "No depth changes proposed. The thesis depths match your identity."
  - Confirmed (empty): "No confirmed depths yet."
  - Surfaced (empty): "No new skills surfaced. The thesis stayed within your identity skill set."

### Per-group affordances
- **Proposed**: full edit form + existing "Write back to Identity" button (handler unchanged; index is original `skillDepthMap` index).
- **Confirmed**: compact row (`<skill> · <depth>` + truncated context), no inputs, no actions.
- **Surfaced**: read-only display (user-approved option). Compact row similar to confirmed but with a "new skill" affordance/tag. Promotion to identity deferred to Phase 2.

### Tests (`src/test/ResearchPage.test.tsx`)
- Mixed-thesis test: assert section headers exist with correct counts (1/1/1).
- Default-collapse test: confirmed `<details>` is not open by default; toggling reveals its entry.
- Empty-state test: with an empty `skillDepthMap`, all three groups render with their empty-state copy.
- Leave every existing skill-writeback test untouched (AC#4).

### Verification
- `npm run typecheck`
- `npx vitest run src/test/ResearchPage.test.tsx`
- Manual smoke: mixed-group thesis, confirm flow + concurrency guard, empty-state copy.

### Out of scope (locked)
- "Add to identity" action for surfaced skills (Phase 2).
- Bulk-accept-all affordance (Phase 2).
- Any change to `handleRequestSkillDepthWriteback`, `buildSkillDepthValueChanges`, `buildSkillDepthMutation`, `describeImpact`, `pendingSkillWriteback` state machine, or the concurrency guard at 826-843.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented Commit 4 as planned with one mid-implementation correction. The user-approved 'read-only surfaced' affordance broke two existing tests because the existing Write back handler returns a useful 'Could not find X in the Identity skill model' error for unmatched skills — that affordance is doing real work today, not dead UI. Updated surfaced to render the full edit form + Write back button to preserve the helpful blocking behavior (AC#4 — existing tests pass unmodified). Confirmed group keeps the edit form (so the existing 'edit search signal/calibration on a generated thesis' test still works) but drops the Write back button since depth already matches. The grouping + collapsed-by-default state are what differentiate confirmed visually now, not stripped affordances.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 Automatic formatting was applied to touched files
- [x] #4 Regression tests pass (scoped to touched files)
- [x] #5 Linters report no warnings or errors in touched files
- [x] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
