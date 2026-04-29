---
id: doc-34
title: >-
  Search Parameters Surface — Hard Constraints + Per-Search Filter Toggles
  (Design)
type: other
created_date: '2026-04-29 08:40'
---
# Search Parameters Surface — Hard Constraints + Per-Search Filter Toggles (Design)

Companion design for the parent task that tracks completing the search parameters surface in the Research workspace. Reader: implementing agent for the parent's subtasks. This document captures every schema decision so subtasks don't have to re-derive them from prior conversation.

Builds on:
- backlog doc-24 (Search Workspace Redesign) — architectural context
- TASK-150 (shipped) — identity-side `condition` field on matching filters
- TASK-165 (To Do) — propagates condition through `SearchProfileFilters`, restructures from `string[]` → `SearchProfileFilterEntry[]`

---

## Architecture principle (carried over from doc-24)

- **Identity = source of truth** (durable self-knowledge): permanent constraints, master prioritize/avoid lists, search vectors, skill positioning.
- **SearchProfile = snapshot for one search instance**: denormalized mirror of identity preferences at search time, plus search-specific overrides.
- **Per-search overrides** live in `SearchInstanceOverrides`, never in identity.
- **Master-list mutation** (add/edit/delete custom prioritize/avoid entries) happens in `IdentityStrategyWorkbench`. Per-search toggles happen in `SearchInstancePreferences`.

This preserves the staleness/snapshot architecture (`SearchRun.identityVersion`) so artifacts remain reproducible when the underlying identity changes.

---

## 1. Bank enums (subtask .1)

Defined as `as const` arrays in `src/types/search.ts`. Users select from them via multi-select; users cannot add custom members. Banks are editable code-side only.

```typescript
export const INDUSTRY_BANK = [
  'adtech',
  'gambling',
  'tobacco',
  'firearms-defense',
  'oil-and-gas-extraction',
  'predatory-lending',
  'social-media-engagement',
  'crypto-speculation',
  'mlm',
] as const
export type SearchIndustry = typeof INDUSTRY_BANK[number]

export const FUNDING_STAGE_BANK = [
  'bootstrapped',
  'pre-seed',
  'seed',
  'series-a',
  'series-b',
  'series-c-plus',
  'late-stage-private',
  'profitable-private',
  'public',
] as const
export type SearchFundingStage = typeof FUNDING_STAGE_BANK[number]

export const REMOTE_POLICY_BANK = [
  'remote-only',
  'remote-friendly',
  'hybrid',
  'onsite-only',
] as const
export type SearchRemotePolicy = typeof REMOTE_POLICY_BANK[number]

export const EMPLOYMENT_TYPE_BANK = [
  'w2-fulltime',
  '1099-contract',
  'either-acceptable',
] as const
export type SearchEmploymentType = typeof EMPLOYMENT_TYPE_BANK[number]
```

Banks should ship with display-label maps so the UI never displays raw enum values. The label map can live alongside each bank in the same module.

`REMOTE_POLICY_BANK` values must align with the existing `identity.preferences.work_model.preference` enum (see `src/identity/schema.ts`). Adapt as needed when implementing.

---

## 2. Identity preference field additions (subtask .1)

In `src/identity/schema.ts`, extend `preferences.constraints`:

```typescript
interface ProfessionalConstraints {
  // existing
  clearance?: ClearanceConstraint
  education?: EducationConstraint
  title_flexibility?: string

  // NEW (all optional, backward-compatible)
  industries_to_avoid?: SearchIndustry[]
  funding_stages_acceptable?: SearchFundingStage[]
  employment_types?: SearchEmploymentType[]
}
```

Note: `work_model.preference` already exists in the identity schema — subtask .1 surfaces it into `SearchProfileConstraints.remotePolicies`; no identity-side schema change for remote policy.

---

## 3. SearchProfileConstraints restructure (subtasks .1 + .2)

Current shape:

```typescript
interface SearchProfileConstraints {
  compensation: string
  locations: string[]
  clearance: string
  companySize: SearchCompanySize | ''
}
```

Target shape:

```typescript
interface SalaryBand {
  min: number       // annualized; currency-agnostic
  max: number
  currency?: string // default 'USD'
}

interface SearchProfileConstraints {
  salary: SalaryBand                          // (.2) replaces `compensation: string`
  locations: string[]
  clearance: ClearanceRequirement              // (.1) narrow type vs free-form string
  companySize: SearchCompanySize | ''

  // NEW (.1) — mirrored from identity at adapt time
  industriesToAvoid: SearchIndustry[]
  fundingStagesAcceptable: SearchFundingStage[]
  remotePolicies: SearchRemotePolicy[]
  employmentTypes: SearchEmploymentType[]
}
```

`identitySearchProfile.adaptIdentityToSearchProfile()` is the only place that should populate these fields. Per the existing snapshot pattern, values are denormalized into the search snapshot at adapt time; user corrections feed back through the identity-writeback flow doc-24 establishes.

---

## 4. Filter item id addition (subtask .3)

**Hard prerequisite: TASK-165 must merge first.**

After TASK-165:

```typescript
// TASK-165 deliverable:
interface SearchProfileFilterEntry {
  label: string
  condition?: string
  severity: 'hard' | 'soft' | 'conditional'
}
```

Subtask .3 extends:

```typescript
interface SearchProfileFilterEntry {
  id: string                    // NEW — stable across edits
  label: string
  condition?: string
  severity: 'hard' | 'soft' | 'conditional'
}
```

ID generation: any url-safe stable id (nanoid is fine). Stability requirement: ids must persist across user edits to `label`, `condition`, or `severity` — they are referenced by per-search override (section 5).

---

## 5. Per-search filter override (subtask .3)

Extend `SearchInstanceOverrides` with a filter-toggle override:

```typescript
interface SearchInstanceFilterOverrides {
  // existing per-search filter fields (additions, custom entries, etc.) — preserve

  // NEW
  disabledFilterIds: string[]   // ids of master-list filters DISABLED for this search only
}
```

**Default semantics**: empty `disabledFilterIds[]` means "all master-list filters apply to this search." Per-search disable does not mutate the master list. Re-enabling for the search just removes the id from the array.

This pattern is space-efficient (most searches will have all filters enabled, so the array is empty), and it makes the default behavior the natural-language expectation ("all my prioritizes/avoids apply unless I say otherwise").

---

## 6. Chained migration in `searchStore.migrateSearchState`

Migrations must be additive and idempotent — older persisted shapes must walk through each step:

| Persisted shape | Migration step | Output |
|---|---|---|
| `string[]` (legacy, pre-TASK-165) | TASK-165 wraps each as `{ label, severity: 'soft' }` | `SearchProfileFilterEntry[]` (no id) |
| `SearchProfileFilterEntry[]` (post-TASK-165, no id) | subtask .3 assigns ids | `SearchProfileFilterEntry[]` (with id) |
| `SearchProfileFilterEntry[]` (post-.3, with id) | no-op | unchanged |

For salary (subtask .2):

- Old `compensation: string` (e.g. `"$120k–$160k"`, `"~$150k"`, `""`): attempt to parse number ranges; on failure, set `salary: { min: 0, max: 0 }` and emit a one-time `console.warn` so the user can re-enter via the slider.
- Old `clearance: string` (`"yes"`, `"no"`, `""`, free-form): map to the new `ClearanceRequirement` enum; default unmappable values to `'none'`.

**Idempotency requirement**: running the migration twice on already-migrated state must be a no-op. Do not regenerate ids on already-id-bearing entries — that would break per-search override references.

---

## 7. UX placement

| Surface | Owner | Lives here |
|---|---|---|
| `IdentityStrategyWorkbench` | Identity | Add/edit/delete prioritize+avoid master list. "Suggest priorities" / "Suggest things to avoid" buttons (already wired via `generateAwarenessFromIdentity` and adjacent flows). |
| `SearchInstancePreferences` (search workspace) | Search | Hard-constraint controls (multi-select chips, salary slider, clearance toggle). Per-item filter checkbox toggle list. "Edit master list" link → IdentityStrategyWorkbench. |

The search workspace must not mutate identity prioritize/avoid lists. If a user wants to add a new entry, the path is "click 'Edit master list' → modify identity → return to search."

---

## 8. Out of scope

- Updating `inferSearchProfileFromIdentity` / `inferSearchProfile` to populate new SearchProfileConstraints fields. The fields must exist before generators can populate them — that's a follow-up after subtasks .1–.5 land.
- Updating `generateSearchVectorsFromIdentity` to the "one new angle per click" pattern. Deferred per user direction.
- Per-search overrides for hard constraints (industries, funding, etc.). Spec calls for static-bank infrequent edits; no per-search toggle needed for these.
- Changing the master-list editor UX in `IdentityStrategyWorkbench`. The existing surface stays as-is; only a "back link" entry point from search needs to be confirmed working.

---

## 9. Definition of "complete" for the parent task

The parent task is complete when, end-to-end:

1. A user can open the Research workspace and see hard-constraint controls populated from their identity.
2. A user can edit constraints in either surface; identity-side edits propagate to the search snapshot via the existing adapter; search-side edits write back through the identity writeback flow.
3. A user can toggle individual prioritize/avoid filters off for one search without mutating the master list.
4. Existing persisted state migrates without data loss; existing tests pass; new tests cover the migration and the override semantics.
5. No raw enum values appear in the UI — all bank values render with display labels.
