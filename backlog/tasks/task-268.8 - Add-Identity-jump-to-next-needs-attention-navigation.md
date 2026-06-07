---
id: TASK-268.8
title: Add Identity jump-to-next-needs-attention navigation
status: Done
assignee: []
created_date: '2026-05-31 20:48'
updated_date: '2026-06-07 19:21'
labels:
  - feature
  - identity
  - ux
milestone: m-35
dependencies: []
references:
  - TODO.md
modified_files:
  - src/routes/identity/IdentityMapPage.tsx
  - src/routes/identity/identityMap.css
  - src/utils/identityAttentionQueue.ts
  - src/test/identityAttentionQueue.test.ts
  - src/test/IdentityMapEditing.test.tsx
parent_task_id: TASK-268
priority: medium
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TODO requests a way to jump to the next Identity item needing user attention or correction. This should work across Map bands and should prioritize actionable gaps, failed/needs-review inference, messy skills, sparse sections, and assumptions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Identity Map exposes a Next attention item action when actionable gaps exist.
- [x] #2 The action selects/focuses the relevant inspector slot and advances through a stable ordered queue.
- [x] #3 The queue includes assumptions, failed or skipped inference, sparse/messy fill-strength signals, and unreviewed inferred items.
- [x] #4 Empty state clearly says there are no attention items.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define an attention-item derivation helper from currentIdentity + transient inference state.
2. Map each item to an existing MapSelection discriminant or a band-level selection.
3. Add navigation controls and focus management to IdentityMapPage/IdentityInspector.
4. Test ordering, stale selection fallback, and no-items behavior.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented a Needs attention panel on Identity Map with a stable derived queue for open assumptions, bullet depth gaps, skill inference review, messy taxonomy, and sparse fill-strength signals. The action selects the relevant inspector slot, advances relative to the current map selection, shows a clear empty state, and avoids ambiguous duplicate-skill row targeting by routing duplicate-name taxonomy issues to the skill group. Added pure queue coverage plus focused Identity Map interaction coverage.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 Automatic formatting was applied to touched files
- [x] #4 Regression tests pass (scoped to touched files)
- [x] #5 Linters report no warnings or errors in touched files
- [x] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
