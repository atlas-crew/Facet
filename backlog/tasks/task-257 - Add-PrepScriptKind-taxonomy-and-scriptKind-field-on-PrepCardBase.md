---
id: TASK-257
title: Add PrepScriptKind taxonomy and scriptKind field on PrepCardBase
status: To Do
assignee: []
created_date: '2026-05-11 04:53'
labels:
  - prep
  - types
  - generator
  - renderer
milestone: m-32
dependencies:
  - TASK-254
references:
  - src/types/prep.ts
  - src/utils/prepGenerator.ts
  - src/routes/prep/PrepCardView.tsx
  - src/routes/prep/PrepLiveMode.tsx
documentation:
  - 'backlog doc-28: Change 5 (script kind half)'
priority: medium
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add `PrepScriptKind` enum to distinguish the four rhetorical script moves currently collapsed into a single free-form `script` string. Per doc-28 Change 5 (script kind half — the bookends half is a separate task).

The enum has members `'opener' | 'honest-bridge' | 'closer' | 'line-that-lands' | 'pivot'`. The `scriptKind?: PrepScriptKind` field is added to `PrepCardBase` so any kind that carries a script can declare its rhetorical function. The existing `scriptLabel` field is retained unchanged as user-facing display text — labels are prose ("First 60 Seconds", "Line that lands for Andrew"); `scriptKind` is structural.

The renderer styles scripts by kind — opener scripts get visual weight; honest-bridge scripts get a distinct callout treatment that highlights the gap → transferable abstraction → ramp pattern. The generator emits `scriptKind` deliberately rather than producing undifferentiated "script" prose. Specifically: when the stack-alignment table from TASK-173 shows a Gap row, the generator emits the honest-bridge pattern ("I want to be direct — my X experience is Y, not Z. The patterns transfer: ... If you're asking me to design the rollout, I'll walk through how I'd approach it; if you want nuances of specific Z integrations I'd be faking it.").

Depends on TASK-254 — scriptKind lands on PrepCardBase, which is introduced by the union foundation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 PrepScriptKind type + PREP_SCRIPT_KIND_VALUES const declared and exported from src/types/prep.ts
- [ ] #2 scriptKind?: PrepScriptKind added to PrepCardBase
- [ ] #3 Existing scriptLabel field retained unchanged (still user-facing prose, not structural enum)
- [ ] #4 PrepCardView styles scripts by scriptKind — opener, honest-bridge, closer, line-that-lands, and pivot get distinct visual treatments
- [ ] #5 prepGenerator.ts emits honest-bridge scripts when stack-alignment table shows a row with Gap confidence (per TASK-173 mapping)
- [ ] #6 prepGenerator.ts emits opener / closer / line-that-lands scripts with appropriate scriptKind values
- [ ] #7 Contract validator accepts the optional scriptKind field and rejects values outside PREP_SCRIPT_KIND_VALUES
- [ ] #8 Regression tests cover scriptKind-aware rendering and generator emission of the honest-bridge pattern on Gap rows
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Regression tests pass (scoped to touched files)
- [ ] #5 Linters report no warnings or errors in touched files
- [ ] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
