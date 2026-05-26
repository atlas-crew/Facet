---
id: TASK-236
title: Manual audience tag override UI in identity workspace
status: In Progress
assignee:
  - '@codex'
created_date: '2026-05-06 20:29'
updated_date: '2026-05-26 21:34'
labels:
  - audience-tagging
  - phase-8
  - ui
milestone: m-28
dependencies:
  - TASK-222
references:
  - src/types/audience.ts
  - src/store/jdAnalysisStore.ts
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

The audience-tagging system has a two-layer model: `inferred` (rules-based, recomputed on every hydration) and `asserted` (LLM- or user-set, preserved across rules-version bumps). Currently only the rules engine writes tags. Phase 5 (TASK-222) adds LLM-asserted writes. This task adds the human-loop counterpart: candidate-controlled overrides via UI.

Without a manual override path, a candidate has no way to say "this concern shouldn't go to recruiters" or "this skill highlight is internal-only" — they're locked into whatever the rules engine and LLM produce.

## Depends on

- TASK-222 (Phase 5 LLM prompt) — until LLM is also writing `asserted`, having only the user as the writer would degenerate the two-layer design into one layer the user owns. Order matters.

## What

- Surface insights with their current `inferred` and `asserted` tags in the identity workspace (or a dedicated audience-review surface)
- Allow per-insight edit: select audiences, save to `asserted`
- Persist via `jdAnalysisStore` (asserted tags survive rules-version bumps automatically)
- Integrates with TASK-224 (unclassified review workflow) — same surface could show both unclassified and asserted-overridable insights

## Acceptance criteria

- UI surface for browsing and editing insight audience tags
- Saves write to `asserted` (never `inferred`)
- Rules-version bump preserves overrides
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-05-26 Codex starting TASK-236 as part of three-surface audience push with TASK-231/TASK-232. Plan: extend TASK-224 Identity audience review into general asserted-audience editor, persist overrides through jdAnalysisStore, cover browsing/editing and rules-version preservation, run gates/review/audit before close.
<!-- SECTION:NOTES:END -->
