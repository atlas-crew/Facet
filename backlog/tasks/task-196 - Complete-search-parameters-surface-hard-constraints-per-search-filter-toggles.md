---
id: TASK-196
title: >-
  Complete search parameters surface (hard constraints + per-search filter
  toggles)
status: Done
assignee: []
created_date: '2026-04-29 08:40'
updated_date: '2026-05-08 19:35'
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
  - backlog doc-39
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Research workspace's search-parameter surface is missing hard constraints (industries to avoid, funding stages, remote policies, employment types, salary band) and previously tracked per-search prioritize/avoid filter toggles.

Per doc-39 and TASK-204, search-stage look-for/avoid signals now live canonically on SearchThesis.lookFor/SearchThesis.avoid. Any surviving per-search signal-disable work must target canonical SearchThesisSignal ids, not legacy searchOverrides.filters.* arrays. The hard-constraints scope remains unchanged.

This parent task tracks the subtasks that complete the surviving surface:
- .1 — Bank enums + identity preference fields (industries / funding / employment / surface remote)
- .2 — Restructure compensation as structured SalaryBand
- .3 — Retarget any per-search signal disablement to canonical SearchThesisSignal ids, or explicitly de-scope it
- .4 — Hard-constraints UI in SearchInstancePreferences
- .5 — Retarget/de-scope any per-item signal toggle UI after TASK-204 canonicalization

Design decisions, bank members, migration logic, and override semantics are documented in backlog doc-34 and doc-39. Subtasks should reference them and not re-derive.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Surviving hard-constraint subtasks are completed and merged
- [x] #2 User can edit hard constraints (industries, funding, remote, employment, salary, clearance) in SearchInstancePreferences and have edits persist
- [x] #3 Any per-search look-for/avoid disabling that remains in scope references canonical SearchThesisSignal ids and does not mutate canonical thesis signals
- [x] #4 Legacy searchOverrides.filters.prioritize/avoid arrays are not revived as canonical storage
- [x] #5 Migration handles existing persisted state without data loss
- [x] #6 No raw enum values appear in the UI — all bank values render with display labels
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

## TASK-204 canonical signal reconciliation (2026-05-07)

doc-39 and TASK-204.1/TASK-204.3 supersede the original TASK-196 filter-toggle storage plan for prioritize/avoid. Do not add ids or disabledFilterIds to legacy searchOverrides.filters.* arrays; those arrays are deleted migration input. TASK-196.3 / TASK-196.5 are retargeted to canonical SearchThesis.lookFor/SearchThesis.avoid signal ids if per-search signal disabling remains in scope, or must explicitly de-scope the toggle UI.

The hard-constraints portion of TASK-196 remains unaffected: industries, funding, remote, employment, salary, clearance, company size, and the SearchInstancePreferences hard-constraint controls continue under TASK-196.4 / surviving parent scope.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed as bookkeeping after all five subtasks landed.

Subtask outcomes:
- TASK-196.1 — schema foundation (bank enums, identity prefs, adapter mirroring, salt for legacy state). Done.
- TASK-196.2 — structured SalaryBand min/max replaced free-form compensation strings with idempotent migration. Done.
- TASK-196.3 — explicitly de-scoped after doc-39/TASK-204.1 made canonical SearchThesisSignal ids stable; per-search signal disablement is not implemented and legacy searchOverrides.filters arrays were not revived. Done.
- TASK-196.4 — hard-constraints UI in SearchInstancePreferences shipped: bank-label chip groups for industries/funding/remote/employment, dual-handle salary controls, clearance 3-state selector, per-session disclosure persistence. Done.
- TASK-196.5 — explicitly de-scoped after canonical thesis-signal cleanup; SearchInstancePreferences renders thesis signals read-only and routes edits to the Search Thesis editor instead of restoring legacy free-text Prioritize/Avoid inputs. Done.

The hard-constraints scope (.1, .2, .4) shipped as planned. The filter-toggle scope (.3, .5) was rationally de-scoped because TASK-204.1 made the underlying storage shape obsolete — building toggles against canonical thesis signals would have duplicated the Search Thesis editor surface that TASK-204.3 already routes to.

Doc-38 Lane C is now closed; rollout-level closure recorded in doc-38 v3 revision history.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
