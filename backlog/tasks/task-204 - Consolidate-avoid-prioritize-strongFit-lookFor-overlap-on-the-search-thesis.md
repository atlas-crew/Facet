---
id: TASK-204
title: Consolidate avoid/prioritize/strongFit/lookFor overlap on the search thesis
status: To Do
assignee: []
created_date: '2026-04-30 23:29'
labels:
  - search-redesign
  - design
dependencies: []
references:
  - src/types/search.ts
  - src/routes/research/searchWorkspaceComponents.tsx
  - src/utils/thesisGenerator.ts
documentation:
  - backlog doc-34 (Search Parameters Surface — Design)
  - backlog doc-24 (Search Workspace Redesign)
  - backlog TASK-203 (run-override cleanup precedent)
  - backlog TASK-196 (hard-constraints UI parent)
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

`SearchThesis` carries four fields that all encode some flavor of "what the search should privilege or reject," but the boundaries between them are unclear and users put the same content in multiple places:

| Field | Type | Edited where |
|---|---|---|
| `thesis.lookFor` | `string[]` | Search Launcher legacy form ("Look-for signals") |
| `thesis.searchOverrides.filters.prioritize` | `string[]` | Profile Editor → `SearchInstancePreferences` |
| `thesis.searchOverrides.interviewPrefs.strongFit` | `string[]` | Profile Editor → `SearchInstancePreferences` |
| `thesis.avoid` | `SearchThesisAvoid[]` (label + condition) | Search Launcher legacy form ("Avoid list") |
| `thesis.searchOverrides.filters.avoid` | `string[]` | Profile Editor → `SearchInstancePreferences` |

All five are thesis-level (not per-run), so this is parallel storage of the same concept rather than override layering.

The presumed original design intent:
- `lookFor` / `avoid` = strategic narrative claim ("for this thesis, look for X")
- `filters.prioritize` / `filters.avoid` = mechanical filter rule ("rule out / boost candidates that match X")
- `interviewPrefs.strongFit` = interview-stage signal

In practice users ignore the distinction and put the same content in all surfaces, creating drift between thesis fields and runtime behavior. This is the same pattern TASK-203 enforced (per `doc-34`) for run-overrides vs thesis-overrides — duplicate storage of the same concept.

## Open design questions for this task

1. **Pick canonical homes.** Probably:
   - `lookFor` (with rich form: maybe `{ label, condition?, severity? }`) → canonical for "search should privilege this." Lives in the Thesis Map's Strategy band (already Map-owned post-migration).
   - `avoid` (existing rich form) → canonical for "search should reject this." Lives in the Thesis Map (or stays on Search Launcher's legacy form until a second-cut migration).
   - `filters.prioritize` / `filters.avoid` → deleted; replaced by `lookFor` / `avoid` enriched with TASK-196's `severity` field once it lands.
   - `interviewPrefs.strongFit` / `interviewPrefs.redFlags` → keep as a separate concept (interview-stage, not search-stage signal); rename to make distinct.
2. **Migration**: existing theses with content in both surfaces need to merge non-destructively. Probably "union, dedupe, lift labels into the rich form."
3. **LLM prompt schema** in `thesisGenerator.ts`: needs a single canonical field instead of two parallel ones.
4. **Coordination with TASK-196**: TASK-196.3 adds `severity` and `id` to filter entries. If we're going to delete `filters.prioritize` / `filters.avoid`, we should do it *before* `.3` ships so we don't add infrastructure to fields that disappear. Or after, accepting one cycle of build-then-delete.

## Out of scope

- Constraints overlap (companySize, compensation, etc.) — already handled by TASK-196 + TASK-203.
- Per-search filter toggle (`disabledFilterIds[]`) — TASK-196.3.

## Notes

This is a design task before an implementation task. The likely first deliverable is a backlog `doc-` companion to `doc-34` that picks the canonical field, names what gets deleted, and sequences the migration relative to TASK-196 subtasks. Implementation can follow as `.1`, `.2`, etc. subtasks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A backlog doc names the canonical home for each concept (lookFor / avoid / filters.prioritize / filters.avoid / interviewPrefs.strongFit / interviewPrefs.redFlags) with the rationale
- [ ] #2 The doc specifies the migration path for existing theses with content in multiple surfaces
- [ ] #3 The doc sequences the work relative to TASK-196 subtasks (specifically .3, which adds severity to filter entries)
- [ ] #4 Implementation subtasks are filed once the design lands
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
