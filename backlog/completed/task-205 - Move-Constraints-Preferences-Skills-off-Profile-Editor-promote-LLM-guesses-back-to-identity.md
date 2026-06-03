---
id: TASK-205
title: >-
  Move Constraints/Preferences/Skills off Profile Editor; promote LLM guesses
  back to identity
status: Done
assignee:
  - Nicholas Ferguson
created_date: '2026-05-01 00:48'
updated_date: '2026-05-24 18:11'
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
modified_files:
  - src/routes/research/ResearchPage.tsx
  - src/routes/research/searchWorkspaceComponents.tsx
  - src/routes/research/research.css
  - src/test/ResearchPage.test.tsx
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
- [x] #1 Phase A: every edit currently performed by <SearchSkillsTable> and <SearchInstancePreferences> has a viable home on the identity Map (PreferencesBand + SearchStrategyBand + SkillsBand), with any gaps filed as targeted small tasks
- [x] #2 Phase B: <SearchSkillsTable> and <SearchInstancePreferences> imports and JSX usage are removed from ResearchPage.tsx; unused components are deleted from searchWorkspaceComponents.tsx and corresponding CSS
- [x] #3 Phase C: Profile Editor tab fate decided (kept as thin Generate Thesis launcher, OR deleted with launcher folded into main Research flow), with rationale recorded in implementation notes
- [x] #4 Phase D: decision recorded on whether per-PreferenceList Promote-to-Identity buttons add value beyond TASK-217's deep-link — if yes, scoped and implemented; if no, dropped with rationale
- [x] #5 Identity-derived list values still flow through hydratePreferenceItems so legacy string[] data continues to render correctly on the identity Map
- [x] #6 Test sweep covers any new identity Map affordances added in Phase A (with model_revision bumps and identity-version stamping)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation plan (Phase C decision: C2 — delete Profile Editor tab)

User-confirmed Phase C decision: **C2 (delete tab, fold Generate Thesis into Search-tab flow)**. The Search tab already has its own Generate Thesis button at `ResearchPage.tsx:2876`, so C2 requires no new launcher placement.

### Phase A — verification (mostly complete on inspection)

Verified before deletion:
- **`<SearchSkillsTable>` is already gone** from `src/routes/research/`. Zero references. The store action `toggleThesisHiddenSkill` (`searchStore.ts:137,915`) still exists but has zero UI callers (only `searchStore.test.ts` exercises it). Orphaned but harmless — flagged for a separate cleanup task, not in scope here.
- **`<SearchInstancePreferences>` canonical home exists**: `IdentityMapPage.tsx:254` renders `<PreferencesBand />`. Task-217's `onNavigateToIdentity` deep-link from Research to `/identity?focus=preferences&return=/research` is already wired. No coverage gap.
- **`<SearchThesisWorkspace>` (Profile-tab thesis surface)**: only consumer is the profile tab. The Search-tab inline thesis editor at `ResearchPage.tsx:2862-3598` covers thesis editing more comprehensively (lanes, lookFor, avoid, skill-depth, etc.). The Profile-tab-only affordances are: corrections textarea + directive input + Search Angles read-only view. These need to be either confirmed-present on the Search tab or migrated there. **Verification step during execution**: grep the Search-tab thesis editor for corrections/directive inputs before deleting SearchThesisWorkspace.

### Phase B — delete components from Research

**`ResearchPage.tsx` edits:**
- Remove imports of `SearchInstancePreferences` and `SearchThesisWorkspace` from `'./searchWorkspaceComponents'` (line 83-87).
- Remove the entire `<ResearchPanel tabId="profile">…</ResearchPanel>` block (lines 2815-2858).
- Remove cross-workspace nav button that targets the profile tab (line ~2727, `<button … onClick={() => setActiveTab('profile')}>`).

**`searchWorkspaceComponents.tsx` edits:**
- Delete `SearchThesisWorkspace` export and its props interface (lines ~128-320).
- Delete `SearchInstancePreferences` export and its props interface (lines ~322-end-of-component).
- Trim imports that become unused after both deletions.

**`research.css` edits:**
- Delete `.research-preferences-*` rules (research.css:1263, 1269-1270, 1280, 1289-1290, 1297, 1304, 1311, 1320, 1328, 1332, 1425 media query, and any helpers I find).
- Delete `.research-thesis-workspace`, `.research-thesis-empty`, `.research-thesis-body`, `.research-thesis-angles`, `.research-thesis-angle-*`, `.research-thesis-controls` rules.
- Inspect `.research-grid-two` — keep if still used in the Search tab (line 2861 wraps the inline thesis section), drop only the dead profile-tab usage at line 2845.

**Test edits:**
- Delete `src/test/SearchInstancePreferences.editInIdentity.test.tsx` (397 lines, 9 tests, entire file targets a deleted component).
- `src/test/ResearchPage.test.tsx`: remove or rewrite tests that interact with deleted Profile-tab surfaces. Specifically the look-for/avoid signal-routing tests (`'routes preference-panel look-for signal edits to the thesis strategy surface'`, `'routes preference-panel avoid signal edits…'`, `'keeps preference-panel thesis signals read-only without legacy filter toggles'`, plus any test that clicks a `'Profile Editor'` tab role or relies on profile being the default tab). Tests that already click `'Search Launcher'` keep working — the click is a no-op once 'search' is the default.

### Phase C2 — delete the Profile Editor tab

`ResearchPage.tsx` edits:
- Line 90: `type ResearchTab = 'profile' | 'search' | 'results'` → `type ResearchTab = 'search' | 'results'`
- Line 93: drop `'profile'` from `RESEARCH_TABS`.
- Line 94-99: drop `{ id: 'profile', label: 'Profile Editor' }` from `RESEARCH_TAB_DEFS`.
- Line 722: `useState<ResearchTab>('profile')` → `useState<ResearchTab>('search')`.
- All `setActiveTab('profile')` callsites (lines 1470, 1596, 2443, 2727): replace with `setActiveTab('search')` or remove the call entirely if it was specifically routing to the profile tab's content. Audit each callsite during execution to decide.

### Phase D — drop "Promote to Identity" per-list button work

Original Phase D considered adding per-PreferenceList "Promote to Identity" buttons. Since `<SearchInstancePreferences>` is being deleted entirely in Phase B, this is moot. The deep-link bridge (task-217) is the canonical promote/edit path.

### Out of scope (flagged, not pulled)

- **"Keyword junk" in the Search-tab thesis editor** (user comment). The inline thesis editor at `ResearchPage.tsx:2862-3598` still exposes keyword combinations, lanes, hard-constraint flows, etc. Per doc-37 (Research is Discovery), this should slim down. NOT in task-205's scope (task-205 explicitly says "out of scope: any research-side Map UI"). Should be filed as a separate task if the user wants it next.
- **Retiring `toggleThesisHiddenSkill` store action**: orphaned but harmless. Separate small cleanup.
- **task-253 commit**: skill-depth grouping changes stay in the working tree alongside this task's edits. Commit strategy (one bundled commit or split) to be decided with user before finalizing.

### Verification

- `npm run typecheck`
- `npm run test -- --run` (the full suite, since multiple test files are touched)
- `npm run lint` scoped to touched files
- Manual smoke: navigate to /research, confirm only two tabs (Search Launcher, Results Viewer), default tab is Search Launcher, thesis editor + skill-depth groups render, layout no longer broken. Combined with task-253 AC#7 smoke.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Executed Phase A/B/C2/D. Phase A verification confirmed identity Map coverage on inspection (PreferencesBand at IdentityMapPage.tsx:254, deep-link via task-217). Phase A also surfaced one Profile-tab-only affordance not present on the Search tab: the corrections textarea + custom directive input. Migrated those to the Search-tab thesis card body as a `<details>` panel under the card header; updated the existing Regenerate Thesis button at ResearchPage.tsx:~2820 to pass `userCorrections` + `customDirective` to handleGenerateThesis. Phase B deleted `<SearchInstancePreferences>` and `<SearchThesisWorkspace>` (and their unused helpers, constants, prop interfaces, and ConstraintChipGroup) from `searchWorkspaceComponents.tsx`; the file went from 660 lines to a minimal SearchAssumptionsDisclosure-only export (~45 lines). Phase B also dropped scoped CSS: `.research-thesis-workspace`, `.research-thesis-empty/body/angles*/narrative/controls`, `.research-skills-compact` family, `.research-icon-btn`, `.research-preferences-*`, `.research-hard-constraints*`, `.research-salary*`, `.research-chip-field`, and the associated media queries. Preserved `.research-btn-ghost` (still used by SearchAssumptionsDisclosure) and `.research-pill`. Phase C2 deleted the Profile Editor tab end to end: `ResearchTab` type, `RESEARCH_TABS`, `RESEARCH_TAB_DEFS`, default tab state (now 'search'), all four `setActiveTab('profile')` callsites (re-pointed to 'search' or removed), and the cross-workspace `Review Profile` button. Phase D dropped as moot. Added a `!effectiveProfile` empty-state guard at the top of the Search tab so the empty profile case still renders 'No search profile yet' (was previously rendered in the Profile tab). Test fallout: deleted `src/test/SearchInstancePreferences.editInIdentity.test.tsx` entirely; deleted 5 obsolete ResearchPage tests targeting deleted preference-panel surfaces; rewrote the keyboard-nav test for 2 tabs; updated the billing-issue test's tab assertion; updated the no-thesis-blocker test to keep profile present (so it exercises the no-thesis path, not the no-profile path). Validation: `npm run test -- --run` green (170 files, 2375 tests). `npx eslint` on touched files clean. `npm run typecheck` had 4 pre-existing errors in prep files (m-32 prep-card-shape-refactor in another agent's working tree) that are unrelated to this task and outside its touched-files scope.

Final closeout (Codex, 2026-05-24): closed the stale remaining checkboxes from the already-landed Research Profile Editor retirement. Current code inspection confirms the research Profile Editor surface is gone: `ResearchTab` only exposes Search Launcher and Results Viewer; `SearchInstancePreferences`, `SearchThesisWorkspace`, and `SearchSkillsTable` have no Research-route references; `searchWorkspaceComponents.tsx` only exports `SearchAssumptionsDisclosure`; and the Search tab preserves the migrated corrections/custom directive regeneration controls plus the no-profile empty state. Identity Map coverage remains in `PreferencesBand`, `SearchStrategyBand`, and `SkillsBand`, with match-rule/search-vector editing covered by `IdentityMapEditing.test.tsx` and identity import/normalization coverage in `professionalIdentity.test.ts` and `identityExtraction.test.ts`. Verification: targeted `pnpm exec vitest run src/test/ResearchPage.test.tsx src/test/IdentityMapEditing.test.tsx src/test/professionalIdentity.test.ts src/test/identityExtraction.test.ts` passed (4 files, 186 tests). The full repo gates also passed immediately before this closeout on the current clean tree: `pnpm run test` (173 files, 2465 tests), `pnpm run lint`, `pnpm run typecheck`, `pnpm run build` with existing chunk-size warnings, and `git diff --check`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed as completed/stale-bookkeeping. The implementation described in the notes is present in current code, the remaining AC/DoD boxes are satisfied, and focused Research/Identity verification passed (4 files, 186 tests). Current repo-wide gates were already green on this clean tree: full tests, lint, typecheck, build, and diff check.
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
