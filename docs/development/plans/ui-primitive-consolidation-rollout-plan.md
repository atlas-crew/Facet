# UI Primitive Consolidation — Rollout Plan

**Milestone:** M12 — UI Primitive Consolidation (`atlas-crew/Facet` milestone #9)
**Tracking issues:** #67–#76 (sequenced; see [Work breakdown](#work-breakdown))
**ADR:** [adr-0011 — Extract a bounded UI primitive layer](../../architecture/decisions/adr-0011-extract-ui-primitive-layer.md)
**Status:** Planned — 2026-06-16

## Problem

Visual and structural inconsistency between workspaces is growing and will keep
growing with each new workspace. A mechanical audit located the drift precisely:
it is **not** at the token layer, which is healthy. It is at the **primitive
layer** — the layer the style guide holds "by convention / by imitation" — and
"imitation" has degraded into "copy-and-diverge" now that the app spans ~8
workspaces.

### Audit evidence (2026-06-16)

| Layer | Health | Evidence |
| --- | --- | --- |
| L1 — Tokens | Healthy | Tokens in a single file (`src/index.css`); **0** literal `font-family`; only 62 hardcoded-hex lines in 16.6k lines of route/component CSS (mostly `identity.css` + the marketing landing page) |
| L2 — Primitives | Fragmenting | **49** distinct button class names; **128** `*-card` classes; **40** `*-badge` classes; **15** eyebrow classes; `.label-tracked` redefined in `identityMap.css`; ~85 `border-radius` declarations off the documented 4/6/8px scale |
| React reuse | Almost none | Only `AiActivityIndicator`/`AiWorkingStatus` are broadly reused. Buttons are inline everywhere — Identity **213**, Prep **86**, Research **42**, Pipeline **40**, Letters **21**, Build **20** |

The canonical `.btn-primary` / `.btn-secondary` / `.btn-ghost` **already exist**,
centralized in `index.css` (~L2731–2817). Workspaces don't use them — each forked
its own `.{ws}-btn*` family, and forked **for a reason**: the suffixes are
`-danger`, `-icon`, `-sm`, `-active` — variants the three global classes never
provided. The primitive was under-specified, so each workspace patched locally.

## Why now — the deferral gate fired

The style guide intentionally defers building a UI package until four conditions
hold (§"When to extract a React primitive"). This is **not** a reversal of that
decision — it is the decision's own trigger firing. Condition #3 ("a bug or
design change has required fixing the same thing in N places") is now met for
buttons: a single button restyle requires editing ~49 class definitions across
12+ CSS files. The benefit the policy was waiting for has arrived; the cost of
*not* extracting now compounds per new workspace. See the ADR for the full
decision record.

## Decision & scope

Extract a **bounded** primitive layer into `src/components/ui/` — the target the
style guide already names — and migrate workspaces onto it incrementally.

**In scope:** `Button` (+ `IconButton`), `SectionLabel` (eyebrow), `StatusBadge`.
A `Card` shell is **investigated, not assumed** (spike #75).

**Explicitly out of scope:**

- **Tokens (L1).** Healthy; untouched.
- **Layer-3 composition.** How primitives compose into "a Match report" vs "a
  Prep deck" is intentionally per-workspace (style guide §"Composition Layer") —
  not standardized.
- **The 128 card classes** as a blanket extraction. Most are legitimately
  different composition. Only shared *chrome* is a candidate, pending the spike.
- **Specialized controls** — `research-feedback-*` (thumbs), `*-action-buttons`
  (layout rows, not buttons).
- A standalone/publishable design system, and claude.ai/design sync. Those
  solved a different problem; this plan targets in-app consistency only.

## Component contracts (derived from real usage, not invented)

Deriving the API from the existing forks satisfies the style guide's extraction
condition #2 (API understood from real usage).

### `Button` / `IconButton`

| Prop | Values | Source in the audit |
| --- | --- | --- |
| `variant` | `primary` \| `secondary` \| `ghost` \| `danger` | 9 `-primary` forks, the bare `.{ws}-btn` → secondary, 3 `-ghost`, 5 `-danger` |
| `size` | `sm` \| `md` (default) | `-sm` (pipeline) |
| `iconOnly` | boolean (→ `IconButton`) | `-icon` in 8 workspaces |
| `pressed` | boolean (toggle) | `-active` (pipeline, research) |
| passthrough | `disabled`, `type`, `title`, `onClick`, … | native `<button>` |

Built on the existing `.btn-*` token rules in `index.css`. Adopts the
standardized AI-action treatment from #31 as the canonical primary+icon usage.

### `SectionLabel` (eyebrow)

One primitive for the mono small-caps tracked wayfinding label. Replaces
`.label-tracked` + 15 eyebrow variants, including the duplicate definition in
`identityMap.css`.

### `StatusBadge`

One primitive for state badges (success / warning / error / info + priority
levels), semantic token × tinted background per the style guide. Category badges
(vector, `--layer-*`) are out of scope.

## Work breakdown

Sequenced by native `blocked-by` dependencies; `gh seq --repo atlas-crew/Facet`
renders the waves.

| Issue | Type | Work | Blocked by |
| --- | --- | --- | --- |
| #67 | Chore | Scaffold `src/components/ui/` + primitive authoring conventions | — |
| #68 | Feature | Extract `Button` + `IconButton` (the contract above) | #67 |
| #69 | Feature | Extract `SectionLabel` | #67 |
| #70 | Feature | Extract `StatusBadge` | #67 |
| #71 | Chore | Button migration **Wave 1** — global-class (Build/Account/Admin/Home/Public) + small forked (Match/Letters/Recruiter/LinkedIn/Debrief) | #68 |
| #72 | Chore | Button migration **Wave 2** — Research, Pipeline, Prep (full variant surface) | #71 |
| #73 | Chore | Button migration **Wave 3** — Identity + Identity Map (~213 buttons, largest) | #72 |
| #74 | Chore | Migrate eyebrows → `SectionLabel`, status badges → `StatusBadge` | #69, #70 |
| #75 | Spike | Card-shell consolidation assessment (go/no-go on a `Card` primitive) | — |
| #76 | Chore | Remove dead forked CSS + add a re-fork guard (lint/CI) | #73, #74 |

### Execution waves (from `gh seq`)

1. **Wave 1:** #67, #75
2. **Wave 2:** #68, #69, #70
3. **Wave 3:** #71, #74
4. **Wave 4:** #72
5. **Wave 5:** #73
6. **Wave 6:** #76

## Migration principles

- **Incremental and bisectable.** Extract a primitive, migrate one workspace
  group, delete that group's forked CSS, commit. No big-bang refactor.
- **Visual parity is the bar.** Each migration reconciles the fork's visual
  delta into a variant; it does not silently restyle. Where forks diverged
  unintentionally, converge to the documented spec.
- **Breadth before depth.** Wave 1 proves the API across many small surfaces;
  Identity (highest blast radius) goes last with lessons applied.
- **Close the loop.** #76 adds a guard so new workspaces use the primitives
  instead of re-forking — the audit showed convention-only enforcement is
  insufficient at this scale.

## Risks

- **Identity blast radius (#73).** 213 inline buttons overlap active map-editing
  work. Sequenced last, after the API has stabilized on Waves 1–2.
- **Under-specified primitive regresses.** If `Button` only re-freezes the three
  original variants, it gets re-forked. Mitigated by deriving the contract from
  the 49 existing classes (#68).
- **Card over-extraction.** Mitigated by gating any `Card` work behind the spike
  (#75) rather than assuming it.
