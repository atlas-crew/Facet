---
id: TASK-205
title: >-
  Move Constraints/Preferences/Skills off Profile Editor; promote LLM guesses
  back to identity
status: To Do
assignee: []
created_date: '2026-05-01 00:48'
labels:
  - search-redesign
  - thesis-map
dependencies: []
references:
  - src/routes/research/searchWorkspaceComponents.tsx
  - src/routes/research/ResearchPage.tsx
  - src/routes/research/ThesisMapPanel.tsx
  - src/routes/research/ThesisInspector.tsx
  - src/routes/research/inspectorSlots/SkillDepthInspector.tsx
  - src/utils/identitySearchProfile.ts
  - src/store/identityStore.ts
documentation:
  - backlog doc-34 (Search Parameters Surface — Design)
  - backlog TASK-195 (Thesis Map migration)
  - backlog TASK-196 (hard-constraints UI parent)
  - backlog TASK-203 (run-override cleanup)
  - backlog TASK-204 (lookFor/prioritize/strongFit consolidation)
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

After the Thesis Map migration (TASK-195) and the duplicate-storage cleanup (TASK-203 + Phase 1 of TASK-204), the Profile Editor tab has degraded into a **residue of three surfaces** that all duplicate or contradict the Map:

1. `<SearchSkillsTable>` — shows skills with a per-thesis "hide" toggle. Skills master is in identity; per-thesis depth annotations are now on the Map's Calibration band. The hide toggle is the only thing this card does that isn't covered elsewhere.
2. `<SearchInstancePreferences>` — edits constraints (compensation, locations, clearance, companySize) + filters (prioritize/avoid) + interview prefs (strongFit/redFlags). All four are thesis-level state and belong on the Map alongside the other thesis bands.
3. The "Generate / Regenerate Thesis from Identity" workspace card — this is the only thing that genuinely belongs to a "Profile Editor" surface.

The user's framing (verbatim, 2026-04-30):
> "i dont se why we need this skills list in profiel editor at all when we have the calibration in thesis map, and these constraints and preferences should be handled similarly in the thesis map, should they not?"

After this task, the Profile Editor tab likely either disappears entirely or reduces to the thesis-generation launcher.

## Scope (sub-phases)

**Phase 2 — Promote inferred prefs back to identity.** The Phase 1 fix (sourcing filters/interviewPrefs from identity) eliminated LLM inference for those four lists, but the LLM's prior guesses were *decent* (the user said so). Add a "Promote to Identity" affordance on each `<PreferenceList>` item, mirroring the SkillDepthInspector's "Write back to Identity" button. So when the user opens an existing thesis and sees a useful inferred entry, they can copy it into `identity.preferences.matching.{prioritize,avoid}` or `identity.preferences.interview_process.{strong_fit_signals,red_flags}` with one click. Closes the only path the prior architecture had for thesis→identity learning.

**Phase 3 — Move Constraints & Preferences into a new Map band.** Add a "Preferences" band alongside Strategy / Lanes / Calibration. The band hosts:
   - Constraints (compensation, locations, clearance, companySize)
   - Filters (prioritize/avoid) — read from identity, edited via the per-thesis disable mechanism
   - Interview prefs (strongFit/redFlags) — same pattern
   - Hidden skills toggle list (replaces the Profile Editor's Skills card)

The band uses the same per-slot edit-commit pattern the rest of the Map uses (`saveThesisRevision`).

**Phase 4 — Remove `<SearchSkillsTable>` and `<SearchInstancePreferences>` from Profile Editor.** Once Phase 3's Preferences band hosts the equivalents, the cards on Profile Editor are pure duplication. Delete them.

**Phase 5 — Profile Editor cleanup decision.** With Skills + Constraints + Preferences gone, the Profile Editor tab has only the thesis-generation launcher. Two options:
   - Keep it as a thin "Generate Thesis" launcher tab.
   - Fold the launcher into the Map's empty-state and delete the tab entirely.

Decide as part of this task; don't pre-commit.

## Coordination with adjacent tasks

- **TASK-196** (hard-constraints UI rebuild): Phase 3's "Preferences" band is the natural home for TASK-196.4 / .5's UI work. Sequence Phase 3 here BEFORE TASK-196.4 ships its UI.
- **TASK-204** (lookFor/prioritize consolidation): the canonical-home decisions made in TASK-204's design doc constrain Phase 3's band shape. Land TASK-204's design before starting Phase 3 implementation.
- **TASK-203** (run-override cleanup): already done; this task builds on the cleared shape.

## Out of scope

- The thesis-generation prompt itself (handled in Phase 1, already done).
- `disabledFilterIds[]` schema work — that's TASK-196.3.
- Match-scoring fixes for conditional severity — that's TASK-165.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Phase 2: each PreferenceList item has a Promote-to-Identity button that writes the label into the corresponding identity master list and bumps identity.model_revision
- [ ] #2 Phase 3: a new Preferences band on the Thesis Map hosts constraints, filters, interview prefs, and hidden-skill toggles
- [ ] #3 Phase 4: SearchInstancePreferences and SearchSkillsTable are removed from the Profile Editor tab
- [ ] #4 Phase 5: the Profile Editor tab is either deleted or reduced to a thin generate-thesis launcher with a documented rationale for the choice
- [ ] #5 All Map bands continue to use the per-slot edit-commit pattern (no global thesisDraft for migrated fields)
- [ ] #6 Identity-derived list values still flow through hydratePreferenceItems so legacy string[] data continues to render correctly
- [ ] #7 Test sweep covers the new Promote-to-Identity flow including model_revision bumps and identity-version stamping on the thesis
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
