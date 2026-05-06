---
id: doc-39
title: Search Thesis Signal Canonicalization Design
type: other
created_date: '2026-05-06 22:44'
---

# Search Thesis Signal Canonicalization Design

Companion to `doc-24` (Search Workspace Redesign), `doc-34` (Search Parameters Surface), and `doc-38` (Research Workspace non-UI rollout). This design resolves TASK-204 before implementation by naming one canonical home for each "what to prefer / what to reject" concept on the search thesis.

## Problem

`SearchThesis` currently stores the same search-stage intent in several places:

- `lookFor`
- `avoid`
- `searchOverrides.filters.prioritize`
- `searchOverrides.filters.avoid`
- `searchOverrides.interviewPrefs.strongFit`
- `searchOverrides.interviewPrefs.redFlags`

The first four are thesis-level search direction. The last two are interview-stage preferences, but their current labels make them easy to treat as another search filter. The result is parallel storage, drift between prompt/runtime surfaces, and extra TASK-196 work to add ids/toggles to fields that should not remain canonical.

## Canonical Homes

| Concept | Canonical home | Decision | Rationale |
|---|---|---|---|
| `lookFor` | `SearchThesis.lookFor` | Keep and enrich in implementation. | This is the strategic "search should privilege these signals" list. It belongs beside the thesis narrative, lanes, and company target signals because it explains what makes a company/opportunity worth researching for this thesis. |
| `avoid` | `SearchThesis.avoid` | Keep and enrich in implementation. | This is the strategic "search should reject or downgrade these signals" list. It already supports `condition`, so it can preserve nuance such as "building around Kubernetes is fine; Kubernetes admin roles are not." |
| `searchOverrides.filters.prioritize` | None after migration. Merge into `SearchThesis.lookFor`. | Deprecate and delete as thesis-level canonical storage. | This is duplicate thesis intent, not a true per-search override. The UI currently edits it in `SearchInstancePreferences`, but each thesis already represents the search instance. Keeping it separate forces users and prompts to choose between two equivalent places. |
| `searchOverrides.filters.avoid` | None after migration. Merge into `SearchThesis.avoid`. | Deprecate and delete as thesis-level canonical storage. | Same duplication as `filters.prioritize`, with extra data loss because `SearchThesis.avoid` can carry a qualifier while `filters.avoid` is only `string[]`. |
| `searchOverrides.interviewPrefs.strongFit` | Interview-stage preferences, retained under an interview-specific name. | Keep concept; rename/copy in implementation to avoid search-filter semantics. | Strong interview fit is about what the candidate should emphasize once a target is in process. It can influence result explanation, but it is not a search inclusion rule. It should remain distinct from `lookFor`. |
| `searchOverrides.interviewPrefs.redFlags` | Interview-stage preferences, retained under an interview-specific name. | Keep concept; rename/copy in implementation to avoid search-filter semantics. | Interview red flags are process/role signals to prepare for or ask about. They are not always hard search rejects. A company can remain worth researching even if the interview process has a known risk. |

Recommended implementation names for the retained interview concept:

- `interviewPrefs.strongFit` -> `interviewPrefs.prepAdvantages`
- `interviewPrefs.redFlags` -> `interviewPrefs.processRisks`

The exact field names can be locked in the implementation subtask, but the labels must make the stage explicit: interview prep and process evaluation, not search-stage filtering.

## Target Shape

The implementation should move toward this model:

```ts
interface SearchThesisSignal {
  id: string
  label: string
  condition?: string
  severity?: 'hard' | 'soft' | 'conditional'
}

interface SearchThesis {
  lookFor: SearchThesisSignal[]
  avoid: SearchThesisSignal[]
  searchOverrides?: {
    constraints: SearchProfileConstraints
    interviewPrefs: SearchInterviewPrefs
    hiddenSkillIds: string[]
  }
}
```

`severity` belongs on the canonical thesis signal if the product needs per-search weighting. It should not be added to `searchOverrides.filters.*` as a long-lived field.

## Migration Path

Migration must be non-destructive, idempotent, and tolerant of partial historical shapes.

1. Normalize existing `lookFor: string[]` into signal entries:
   - `label` is the trimmed string.
   - `condition` is omitted.
   - `severity` defaults to `soft`.
   - `id` is generated once and preserved on later migrations.

2. Normalize existing `avoid: SearchThesisAvoid[]` into signal entries:
   - Preserve `label`.
   - Preserve `condition`.
   - `severity` defaults to `conditional` when `condition` exists, otherwise `soft`.
   - `id` is generated once and preserved on later migrations.

3. Merge `searchOverrides.filters.prioritize[]` into `lookFor`:
   - Trim and drop empty strings.
   - Dedupe case-insensitively against existing `lookFor.label`.
   - If the duplicate has no richer data on either side, keep the existing canonical item.
   - If a later implementation supports source metadata, record that the item was lifted from the legacy override surface; do not require this for migration correctness.

4. Merge `searchOverrides.filters.avoid[]` into `avoid`:
   - Trim and drop empty strings.
   - Dedupe case-insensitively against existing `avoid.label`.
   - Preserve existing `avoid.condition` when present.
   - Lift string-only legacy items as `{ label, severity: 'soft' }`.

5. Remove `searchOverrides.filters` after both arrays are lifted:
   - If `filters` is empty or missing, treat it as already migrated.
   - Do not leave both canonical and legacy fields populated after migration.
   - Do not mutate `searchOverrides.constraints`, `searchOverrides.interviewPrefs`, or `hiddenSkillIds`.

6. Keep interview prefs during the first migration:
   - Copy `strongFit` and `redFlags` to their renamed fields only when the rename lands.
   - Leave arrays untouched when the implementation only removes `filters`.
   - Do not merge interview strings into `lookFor`/`avoid` automatically; that would collapse stage semantics and could turn prep advice into search filtering.

## Prompt And Normalization Changes

`src/utils/thesisGenerator.ts` should stop asking the LLM for duplicate filter arrays. The response schema should ask for:

- canonical search-stage signals: `lookFor`, `avoid`
- interview-stage guidance: renamed interview prefs or existing `strongFit`/`redFlags` until the rename subtask lands
- constraints and `hiddenSkillIds` under `searchOverrides`

`normalizeGeneratedSearchThesis` should treat legacy generated `searchOverrides.filters.*` as migration input, not as canonical output. This keeps old responses importable while making new generation produce the single canonical surface.

## UX Placement

- Search thesis strategy / Thesis Map owns editing `lookFor` and `avoid`.
- `SearchInstancePreferences` should stop exposing free-text `Prioritize` and `Avoid` inputs once migration lands.
- If per-search enable/disable remains desired, it should reference canonical thesis signal ids, not duplicate filter strings.
- Interview-stage fields can remain in the preferences panel, but labels should read as interview/prep concepts rather than search filters.

## Sequencing Relative To TASK-196

TASK-204 should land before TASK-196.3.

Reason: TASK-196.3 currently plans to add stable ids and `disabledFilterIds[]` to `SearchProfileFilterEntry` / `SearchInstanceFilterOverrides`. If Lane B deletes `searchOverrides.filters.prioritize` and `searchOverrides.filters.avoid`, adding ids to those legacy filter arrays is churn. The safer sequence is:

1. TASK-204 design lands and files implementation subtasks.
2. TASK-204.1 migrates thesis signal storage and removes `searchOverrides.filters.*`.
3. TASK-204.2 updates generator schema/normalization to emit only canonical search-stage fields.
4. TASK-204.3 updates Research workspace copy/wiring so search-stage `lookFor`/`avoid` are edited in the thesis strategy surface and interview-stage prefs remain distinct.
5. TASK-196.3 is revised or superseded to add ids/toggles against canonical thesis signals only if per-search disabling is still needed.
6. TASK-196.4 / TASK-196.5 continue after the storage decision is reflected in their scope.

If TASK-196.3 lands first, TASK-204 implementation must include a cleanup migration from id-bearing `SearchProfileFilterEntry[]` to canonical thesis signals. That is feasible but creates one cycle of build-then-delete work and more migration branches.

## Implementation Subtasks To File

File these as children of TASK-204 after this design lands:

1. Schema + migration: enrich canonical thesis signals and lift legacy `searchOverrides.filters.*` into `lookFor`/`avoid`.
2. Generator contract cleanup: remove duplicate filter arrays from the thesis-generation prompt and normalize legacy outputs as migration-only input.
3. Research workspace preference cleanup: remove search-stage prioritize/avoid text inputs from `SearchInstancePreferences`, clarify interview-stage labels, and route canonical signal edits to the thesis strategy surface.
4. TASK-196 reconciliation: update TASK-196.3 / TASK-196.5 scope so ids and toggles target canonical thesis signals, or close the filter-toggle portion if the product no longer needs per-search disabling.

## Non-Goals

- Do not change compensation, company size, funding, industry, remote, or employment constraints here; those remain under TASK-196 and TASK-203's precedent.
- Do not move identity master matching preferences in this task. Identity preferences remain durable source material; this design only removes duplicate thesis-level storage.
- Do not implement source code in TASK-204. This task is the decision artifact that unblocks implementation subtasks.
