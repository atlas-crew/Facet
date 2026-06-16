---
id: adr-0011
title: Extract a bounded UI primitive layer into src/components/ui/
date: 2026-06-16
status: accepted
---

## Context

The style guide (`docs/development/ui/facet-style-guide.md`,
§"Architecture & Layered Conventions") deliberately declined to build a Facet UI
package. Consistency was held by three layers: tokens (strong, enforced),
primitives (moderate, by convention), and composition (weak, by workspace). The
guide codified a four-condition gate before extracting *any* React primitive
into `src/components/ui/`:

1. The pattern appears in 3+ workspaces with effectively-identical implementation.
2. The API surface is genuinely understood from real usage, not invented.
3. A bug or design change has required fixing the same thing in N places.
4. The cost of extraction is justifiable against the cost of continuing to copy.

That decision was correct while the app had a handful of workspaces. The app now
spans ~8 workspaces, and a mechanical audit (2026-06-16) found the predicted
failure mode of convention-only consistency at scale:

- **Tokens (L1) are healthy** — centralized in one file, no literal fonts, ~62
  hardcoded-hex lines in 16.6k lines of CSS.
- **Primitives (L2) have fragmented** — **49** forked button classes, **128**
  `*-card` classes, **40** `*-badge` classes, **15** eyebrow classes,
  `.label-tracked` redefined in `identityMap.css`, and ~85 off-scale
  `border-radius` values.
- The canonical `.btn-*` classes exist but go unused: each workspace forked its
  own `.{ws}-btn*` family, specifically to add `-danger` / `-icon` / `-sm` /
  `-active` variants the three global classes never provided.

The gate's **condition #3 is now met for buttons**: restyling the button means
editing ~49 class definitions across 12+ files. Conditions #1, #2, and #4 follow
from the same data (the variants recur across workspaces, the real API is
recoverable from the forks, and the N-place maintenance cost now exceeds
extraction cost).

## Decision

**Extract a bounded primitive layer into `src/components/ui/`** — `Button`
(+ `IconButton`), `SectionLabel` (eyebrow), and `StatusBadge` — and migrate
workspaces onto it incrementally. A `Card` shell is investigated via a spike,
not assumed.

This is **not a reversal** of the deferral decision; it is that decision's own
trigger firing. The four-condition gate was the mechanism for deciding *when* to
extract, and it has now fired for the primitive layer.

Scope is deliberately bounded:

- **Tokens are untouched** — Layer 1 is healthy.
- **Layer-3 composition stays per-workspace** — how primitives compose into a
  Match report vs a Prep deck is intentionally divergent and is not standardized.
- **The 128 card classes are not blanket-extracted** — most are legitimate
  composition; only shared chrome is a candidate, gated behind spike #75.
- **No standalone/publishable design system and no claude.ai/design sync** —
  those address a different goal. This decision targets in-app consistency only.

The component APIs are **derived from the 49 existing forked classes**, not
invented, to satisfy condition #2 directly.

Rollout is tracked in milestone **M12 — UI Primitive Consolidation** (#67–#76),
sequenced by native `blocked-by` dependencies. See
[the rollout plan](../../development/plans/ui-primitive-consolidation-rollout-plan.md).

## Consequences

- **Positive.** A single source of truth for buttons, eyebrows, and status
  badges; a button restyle becomes a one-file change; new workspaces compose
  primitives instead of forking CSS; the felt inconsistency between pages
  resolves at its actual source.
- **Cost.** Migrating ~430 inline buttons across workspaces, Identity being the
  largest single surface (~213). Mitigated by incremental, bisectable waves with
  visual-parity checks, and by sequencing Identity last.
- **New invariant.** A re-fork guard (lint/CI, issue #76) enforces use of the
  primitives — convention alone proved insufficient at this scale, which is the
  root cause this ADR addresses.
- **Style guide update.** §"When to extract a React primitive" now records that
  the gate fired for the primitive layer and points here and to the rollout plan.
- **Reversibility.** Low risk: primitives are additive; if a primitive proves
  wrong, callers revert to inline implementation per the existing convention.
