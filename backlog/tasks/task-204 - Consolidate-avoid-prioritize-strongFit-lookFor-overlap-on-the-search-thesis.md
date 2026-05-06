---
id: TASK-204
title: Consolidate avoid/prioritize/strongFit/lookFor overlap on the search thesis
status: Done
assignee:
  - '@codex'
created_date: '2026-04-30 23:29'
updated_date: '2026-05-06 22:47'
labels:
  - search-redesign
  - design
dependencies: []
references:
  - src/types/search.ts
  - src/routes/research/searchWorkspaceComponents.tsx
  - src/utils/thesisGenerator.ts
documentation:
  - backlog doc-39
  - backlog doc-34
  - backlog doc-24
  - backlog TASK-203
  - backlog TASK-196
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
- [x] #1 A backlog doc names the canonical home for each concept (lookFor / avoid / filters.prioritize / filters.avoid / interviewPrefs.strongFit / interviewPrefs.redFlags) with the rationale
- [x] #2 The doc specifies the migration path for existing theses with content in multiple surfaces
- [x] #3 The doc sequences the work relative to TASK-196 subtasks (specifically .3, which adds severity to filter entries)
- [x] #4 Implementation subtasks are filed once the design lands
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

1. Create a new Backlog doc companion to doc-24/doc-34 that makes the thesis concept boundaries explicit: keep thesis-level search direction in `SearchThesis.lookFor` / `SearchThesis.avoid`, remove duplicated `searchOverrides.filters.prioritize` / `searchOverrides.filters.avoid` as canonical storage, and keep interview-stage fields separate from search-stage criteria.
2. Specify a non-destructive migration for persisted theses: union/dedupe duplicate prioritize/lookFor and avoid surfaces into the canonical thesis fields, preserve qualifier text where available, and leave interview prefs untouched except for naming/UX clarification.
3. Sequence the implementation against TASK-196/TASK-196.3 so Lane B removes the duplicated filters before TASK-196.3 adds IDs/per-search disabledFilterIds to fields that may disappear.
4. File focused implementation subtasks from the design doc for schema/migration/generator work and UI copy/wiring cleanup; keep source-code changes out of this design task.
5. Verify through Backlog reads/status plus focused grep of the new doc/tasks; commit only the Lane B design/task files with `cortex git commit`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Progress - 2026-05-06

- Created backlog doc-39, "Search Thesis Signal Canonicalization Design", as the doc-24/doc-34 companion for TASK-204.
- Filed implementation subtasks TASK-204.1 through TASK-204.4 for schema/migration, generator contract cleanup, Research preferences cleanup, and TASK-196 reconciliation.
- Kept TASK-204 source-free per Lane B design scope; implementation is delegated to child tasks.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## What changed

- Added backlog doc-39, "Search Thesis Signal Canonicalization Design", naming canonical homes for lookFor, avoid, legacy searchOverrides.filters.prioritize/avoid, and interviewPrefs strongFit/redFlags.
- Specified a non-destructive migration path that lifts legacy filter arrays into canonical thesis signals, dedupes case-insensitively, preserves avoid.condition, and leaves constraints/interview prefs/hiddenSkillIds intact.
- Sequenced the work before TASK-196.3 to avoid adding ids/toggles to fields slated for deletion.
- Filed TASK-204.1, TASK-204.2, TASK-204.3, and TASK-204.4 as implementation/reconciliation follow-ups.

## Verification

- backlog doc view 39
- backlog task 204 --plain
- backlog task 204.1 --plain
- backlog task 204.2 --plain
- backlog task 204.3 --plain
- backlog task 204.4 --plain
- git diff --check

No source implementation was performed, so code tests/build were not run for this design-only task.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Design doc created and linked from TASK-204
- [x] #2 Migration path documented for overlapping persisted thesis fields
- [x] #3 Sequencing relative to TASK-196.3 documented
- [x] #4 Implementation subtasks filed and linked
- [x] #5 Design/task documentation verified with Backlog CLI
<!-- DOD:END -->
