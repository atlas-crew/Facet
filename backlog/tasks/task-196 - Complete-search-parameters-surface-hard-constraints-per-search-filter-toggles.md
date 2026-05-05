---
id: TASK-196
title: >-
  Complete search parameters surface (hard constraints + per-search filter
  toggles)
status: To Do
assignee: []
created_date: '2026-04-29 08:40'
labels:
  - search-redesign
  - identity-model
dependencies: []
references:
  - src/types/search.ts
  - src/store/searchStore.ts
  - src/identity/schema.ts
  - src/utils/identitySearchProfile.ts
  - src/routes/research/searchWorkspaceComponents.tsx
  - src/routes/identity/inspectorSlots/MatchRuleInspector.tsx
documentation:
  - backlog doc-24 (Search Workspace Redesign)
  - backlog doc-34 (Search Parameters Surface — Design)
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Research workspace's search-parameter surface is missing hard constraints (industries to avoid, funding stages, remote policies, employment types, salary band) and per-search filter toggles (enable/disable individual prioritize/avoid items per search instance without mutating the master list).

Per the architecture established in doc-24 (Search Workspace Redesign), durable self-knowledge lives in the identity model and is mirrored into the search snapshot; per-search overrides live in the search instance only.

This parent task tracks the five subtasks that complete this surface end-to-end:
- .1 — Bank enums + identity preference fields (industries / funding / employment / surface remote)
- .2 — Restructure compensation as structured `SalaryBand`
- .3 — Add stable id to filter entries + per-search `disabledFilterIds` override (depends on TASK-165)
- .4 — Hard-constraints UI in `SearchInstancePreferences`
- .5 — Per-item filter toggle UI in `SearchInstancePreferences`

Subtasks .1 and .2 can run in parallel. .3 waits on TASK-165. .4 and .5 are UI work and run last in parallel after their schema dependencies land.

Design decisions, bank members, migration logic, and override semantics are documented in backlog doc-34. Subtasks should reference it and not re-derive.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All five subtasks completed and merged
- [ ] #2 User can edit hard constraints (industries, funding, remote, employment, salary, clearance) in SearchInstancePreferences and have edits persist
- [ ] #3 User can disable individual prioritize/avoid filters for a single search without affecting the master list
- [ ] #4 Master list edits via Identity Map's MatchRuleInspector correctly propagate to search snapshots via the existing adapter pattern
- [ ] #5 Migration handles existing persisted state without data loss
- [ ] #6 No raw enum values appear in the UI — all bank values render with display labels
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Reference reconciliation (2026-05-05)

This task and its subtasks were filed when `IdentityStrategyWorkbench` was the master-list editor. That component was retired in commit `6afda50` (`feat(identity): retire IdentityStrategyWorkbench so Map is the canonical-edit surface`) per TASK-195. Master-list editing now lives on the Identity Map via `MatchRuleInspector` (`src/routes/identity/inspectorSlots/MatchRuleInspector.tsx`), which writes back to `identity.preferences.matching.prioritize`/`avoid`. The identity-side write path the original spec depends on already exists; only references and cross-workspace navigation needed updating.

Doc-34's §1, §7, and §8 were reconciled in the same commit as this note.

## Coordination question for user lock — slot/sheet interaction

TASK-202 (Strategy D, in progress) is converging the Identity Map onto two editor primitives — inline aside slots and the new `InspectorSheet` (TASK-202.1, shipped in `096ab9c`/`3b3be96`/`df5fae2`/`5995736`). Pattern guard from TASK-202: **slots = `MapSelection` discriminants, 1:1.** A sheet is a UI transport for a slot's edit mode, not a new slot file.

Reading TASK-196's UI subtasks against this:

- **TASK-196.4 (hard constraints UI in `SearchInstancePreferences`)** — chips, salary slider, clearance toggle. **Lives in the Research workspace, not the Map.** Not a sheet primitive consumer. No coordination dependency on TASK-202.
- **TASK-196.5 (per-item filter toggle list in `SearchInstancePreferences`)** — list view + checkboxes + "Edit master list" link. The list is inline in the search workspace. **Not a sheet primitive consumer.** The "Edit master list" link, however, must navigate to the Identity Map's `MatchRuleInspector` slot (replacing the dead `IdentityStrategyWorkbench` route). That cross-workspace navigation is a coordination point — see below.

Real coordination questions to lock before TASK-196.5 ships:

1. **Cross-workspace navigation pattern.** Does "Edit master list" simply route the user to the Identity workspace, or does it deep-link to the relevant `MatchRuleInspector` selection (calling `setMapSelection({ type: 'matchRule', kind: 'prioritize'\|'avoid', id })` after route navigation)? The MapSelection-driven approach is more polished but needs a route → selection bridge that doesn't exist yet. A plain route navigation is mechanically simpler but lands the user at the Map root with no contextual selection.

2. **Editing experience on the Map for long custom rule entries.** If a user adds a multi-sentence custom prioritize rule, `MatchRuleInspector`'s inline aside fields may feel cramped (≥80 chars / multi-line is the documented sheet heuristic in TASK-202.1's `InspectorSheet` comment block). Lifting the rule-text edit onto the sheet is a TASK-202.2 lift decision, not a TASK-196 dependency. **Not blocking** TASK-196 — flagging so the lift survey TASK-202.2 runs considers `MatchRuleInspector` text fields as candidates.

3. **"Suggest priorities" / "Suggest things to avoid" affordances** previously wired in the retired workbench via `generateAwarenessFromIdentity`. If still in scope, they need a Map-side home. Out of scope for TASK-196; track separately if the user wants them re-surfaced.

**Awaiting user lock on (1).** TASK-196.5's "Edit master list" link target should be specified before subtask kickoff.
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
