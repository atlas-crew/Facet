---
id: TASK-205
title: >-
  Move Constraints/Preferences/Skills off Profile Editor; promote LLM guesses
  back to identity
status: To Do
assignee: []
created_date: '2026-05-01 00:48'
updated_date: '2026-05-08 23:26'
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
## Status (2026-05-08 — refreshed during backlog staleness audit; supersedes earlier description)

This task's original framing (filed 2026-05-01) predated three architectural shifts that change its shape:

1. **doc-37 (2026-05-04) — Research is Discovery, not a per-listing artifact.** Research reads from Identity (search criteria, vectors, preferences) via SearchProfile snapshot; it is upstream of Pipeline. This makes the "research workspace owns its own Map" framing wrong — there should not be a research-side thesis Map; identity is the canonical authoring surface for search criteria.
2. **doc-38 v3 (2026-05-08) — Research Workspace 4-lane rollout closed.** TASK-204 + sub-tasks consolidated thesis signals (`SearchThesis.lookFor` / `avoid` canonical; `searchOverrides.filters.*` deprecated and lifted into canonical fields). TASK-204.3 cleaned up Research preferences after canonical thesis signals.
3. **doc-40 v2 (2026-05-07/08) — Identity Map convergence closed.** Identity Map gained `SearchStrategyBand` (search vectors + open questions, with full add/remove/edit) and `PreferencesBand`. The candidate identity Map is the canonical edit surface for search vectors and preferences.

**Verified current state (2026-05-08):**

- `src/routes/research/` contains only: `research.css`, `ResearchPage.tsx`, `researchUtils.ts`, `searchWorkspaceComponents.tsx`. **There is no `ThesisMapPanel.tsx` or `ThesisInspector.tsx` or `inspectorSlots/`** — those references in the original description never landed (and per doc-37 should never land).
- `src/routes/identity/bands/` contains `PreferencesBand.tsx`, `SearchStrategyBand.tsx`, `ProfilesBand.tsx`, `RolesBand.tsx`, `SelfModelBand.tsx`, `SkillsBand.tsx`, `ThesisBand.tsx`. `IdentityMapPage.tsx` renders `<PreferencesBand />` and `<SearchStrategyBand />` (lines 254-255).
- `ResearchPage.tsx` line 99: `{ id: 'profile', label: 'Profile Editor' }` — Profile Editor tab still exists.
- `ResearchPage.tsx` line 3194: `<SearchSkillsTable />` still rendered. Line 3203: `<SearchInstancePreferences />` still rendered, with an `onNavigateToIdentity` deep-link to `/identity?focus=preferences&return=/research` (TASK-217's bridge).
- TASK-217 (cross-workspace deep-link bridge) shipped Done.

## Refreshed scope

The original Phase 1 (regenerate thesis from identity, Phase 1 fix sourcing filters/interviewPrefs from identity) is shipped. What remains is the **structural retirement** of the residual Profile Editor surface in Research, with all canonical authoring routed to the identity Map.

### Phase A — Verify identity Map covers the Research Profile Editor's edit surface

Before deletion, confirm every edit Research's Profile Editor currently does has a viable home on the identity Map:

- **Skills hide/restore for a thesis** (the `<SearchSkillsTable>` job): hidden-skill toggles per active thesis. Currently routed to `toggleThesisHiddenSkill`. The identity Map's SkillsBand/SearchStrategyBand may need a per-thesis "hide from this thesis" affordance, OR this becomes a thesis-scoped overlay editable from a thin Research-side surface (not Profile Editor).
- **Constraints (compensation, locations, clearance, companySize)** + **filters (prioritize/avoid)** + **interview prefs (strongFit/redFlags)**: per `<SearchInstancePreferences>`. Identity's PreferencesBand should hold these; verify all four sub-categories have first-class edit affordances. The `onNavigateToIdentity` link suggests this routing already partly works — confirm it's complete.

If any gap exists on identity Map, file targeted small tasks to close it FIRST. Do not delete the Research-side cards until identity Map covers their job.

### Phase B — Delete `<SearchSkillsTable>` and `<SearchInstancePreferences>` from Profile Editor

Once Phase A confirms parity:
- Remove the imports and JSX usage at `ResearchPage.tsx:3194` and `:3203`
- Delete the components from `searchWorkspaceComponents.tsx` if unused
- Delete the corresponding sections of `research.css` if scoped

### Phase C — Profile Editor tab decision

With Skills + Constraints + Preferences gone, the Profile Editor tab has little left. Decide:
- **Option C1**: keep as a thin "Generate Thesis" launcher tab (re-runs `handleGenerateThesis`) — preserve the regen affordance
- **Option C2**: fold the launcher into the Research workspace's main flow (e.g., a button in the search results header) and delete the tab entry at `ResearchPage.tsx:99`

Either way: doc-37's framing supports a leaner Research workspace whose UI is opportunities-list + per-opportunity actions + thesis launcher only. Don't preserve the tab structure for its own sake.

### Phase D — "Promote inferred preferences to identity" (was original Phase 2)

Original task included a per-PreferenceList "Promote to Identity" button. Reverify whether this is still needed: TASK-217's deep-link routes users to identity Map preferences directly, which may be the preferred flow (edit at the canonical surface). If a per-item promote button is still wanted (e.g., to quickly capture a useful inferred entry into identity without leaving Research), confirm scope and add to Phase A.

## Out of scope

- The thesis-generation prompt itself (Phase 1, shipped).
- `disabledFilterIds[]` schema work (closed via TASK-196.3 as descoped per doc-38 v3).
- Match-scoring fixes for conditional severity (TASK-165, Done).
- Any research-side Map UI (per doc-37, this should not exist).

## Coordination

- TASK-217 (deep-link bridge) is shipped — relied on for the `onNavigateToIdentity` flow.
- doc-38 v3 is closed; TASK-204 sub-tasks landed. Canonical thesis signal storage is settled.
- doc-40 v2 is closed; identity Map's PreferencesBand and SearchStrategyBand are stable.

---

## Original description (preserved for reference)

The earlier framing assumed a research-side Thesis Map workspace. Per doc-37 that surface should not exist. The Phase 2/3/4/5 numbering and the "new Map band on Research" verbiage in the original description are outdated. Phase A/B/C/D above replace them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Phase A: every edit currently performed by <SearchSkillsTable> and <SearchInstancePreferences> has a viable home on the identity Map (PreferencesBand + SearchStrategyBand + SkillsBand), with any gaps filed as targeted small tasks
- [ ] #2 Phase B: <SearchSkillsTable> and <SearchInstancePreferences> imports and JSX usage are removed from ResearchPage.tsx; unused components are deleted from searchWorkspaceComponents.tsx and corresponding CSS
- [ ] #3 Phase C: Profile Editor tab fate decided (kept as thin Generate Thesis launcher, OR deleted with launcher folded into main Research flow), with rationale recorded in implementation notes
- [ ] #4 Phase D: decision recorded on whether per-PreferenceList Promote-to-Identity buttons add value beyond TASK-217's deep-link — if yes, scoped and implemented; if no, dropped with rationale
- [ ] #5 Identity-derived list values still flow through hydratePreferenceItems so legacy string[] data continues to render correctly on the identity Map
- [ ] #6 Test sweep covers any new identity Map affordances added in Phase A (with model_revision bumps and identity-version stamping)
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
