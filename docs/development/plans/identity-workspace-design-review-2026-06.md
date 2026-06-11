# Identity Workspace Design & Journey Review — Remediation Plan

**Milestone:** M10: Identity Workspace Design Polish (GitHub milestone #7)
**Date:** 2026-06-11
**Scope:** The Identity workspace's two surfaces — the **Map** (`/identity`,
`IdentityMapPage.tsx` + `identityMap.css`) and **Import** (`/identity/import`,
`IdentityPage.tsx` + `identity.css` + `ExtractionAgentCard.tsx` +
`ScanReviewPane.tsx`).

## Context

A combined visual-design and user-journey review found that the two surfaces
have drifted in opposite directions. **Import** matured into a clean,
self-pacing state machine with progressive-disclosure onboarding. **Map** — the
canonical daily-editing surface — accumulated permanent guidance panels, a
sprawling half-pixel type scale, two undefined design tokens, and a tri-meaning
green collision. The throughline of this milestone: make the Map respect its
returning power-user the way Import already does, and pay down the token debt
that let the drift happen.

Every finding below was verified against source (`file:line`), not inferred.

## Issue index

| Finding | Issue | Type | Priority | Status |
| --- | --- | --- | --- | --- |
| 1 — Undefined CSS tokens (`--space-5`, `--layer-search`) | [#47](https://github.com/atlas-crew/Facet/issues/47) | Bug | High | Todo |
| 2 — Tri-meaning green collision (Self band) | [#42](https://github.com/atlas-crew/Facet/issues/42) | Bug | High | Todo |
| 3 — Map respects returning users | [#43](https://github.com/atlas-crew/Facet/issues/43) | Chore | High | Todo |
| 4 — Font-size token scale + migration | [#44](https://github.com/atlas-crew/Facet/issues/44) | Chore | Medium | Backlog |
| 5 — Document decorative-header exception | [#45](https://github.com/atlas-crew/Facet/issues/45) | Chore | Medium | Backlog |
| 6 — Import review-step polish | [#46](https://github.com/atlas-crew/Facet/issues/46) | Feature | Low | Backlog |

## Findings → issues

### 1. Undefined CSS custom properties in the Identity Map — `Bug`, High

`--space-5` is referenced at `identityMap.css:229` and `:2767` but is **never
defined** (the scale is `--space-1/2/3/4/6/8`). Because `margin`/`padding` do
not inherit, `var(--space-5)` is invalid at computed-value time and silently
falls to `0` — the guide's intended top margin and a responsive padding rule
just don't render, and it breaks the 4px-grid token contract.

`--layer-search` is referenced at `identityMap.css:523` (the 7th band,
SearchStrategyBand) but is **never defined**. The rail falls back to
`--border-default`, so Search Strategy is the only band without a distinct
identity hue.

**Fix:** add `--space-5: 20px` to the grid in `index.css` (or retarget the two
call sites to `--space-4`/`--space-6`); add a distinct `--layer-search` token to
both `:root[data-theme='light']` and `[data-theme='dark']`.

**Acceptance:** no undefined custom-property references in identity CSS
(`grep -rE 'var\(--(space-5|layer-search)' src/` resolves to defined tokens);
Search Strategy band shows a distinct rail color in both themes.

### 2. Tri-meaning green collision in the Self Model band — `Bug`, High

Within the Self Model band, one green carries three meanings:
- `--band-color: var(--layer-self)` (`identityMap.css:508`) — the band's
  *content-type identity*.
- `--layer-self` **is** `var(--success)` (`index.css:256`) — *operational
  success/ready*; the `.identity-action-status.accepted/.ready` badges use this
  same green (`identityMap.css:430–438`).
- `.interview-strength { border-left-color: var(--success) }`
  (`identityMap.css:861`) — a *value judgment* ("this is a strength"), with no
  accompanying label.

The style guide explicitly warns against this: *"Don't use `--success` green as
a decorative accent for 'good things' — it carries a specific operational-state
meaning."*

**Fix (keep the alias, enforce the guide's own rule):** at the collision sites,
ensure green is never the sole differentiator. Give `.interview-strength` /
`.interview-weakness` a labeled chip or a non-`--success` treatment so the
band-identity green, the status green, and the strength green are
distinguishable.

**Acceptance:** no element in the Self band uses bare `--success` color as its
only signal; strength/weakness carry text or shape in addition to hue.

### 3. Make the Identity Map respect returning users — `Chore`, High

The "How to use this map" guide (`IdentityMapPage.tsx:1591`) renders whenever
`identity` exists — **no first-visit gating**, unlike Import's
`showImportGuide = !currentIdentity || Boolean(draft) || hasSourceMaterial`
(`IdentityPage.tsx:299`). The "Needs attention" panel (`:1715`) renders
**permanently** even when empty (shows "No attention items"), unlike the
adjacent next-action/run-all/stale panels, which are conditional. Result: a
returning user with a populated identity must scroll past ~180px of guide plus a
"Needs attention (Clear)" panel before reaching the bands they came to edit — a
density inversion on the most-visited surface.

**Fix:** gate the Map guide on a first-visit / empty-ish condition (mirror the
Import pattern, persisted in a local-only preference); collapse the "Needs
attention" panel to a thin affordance when there are zero items.

**Acceptance:** a returning user with a populated identity and zero attention
items reaches the band stack within the first viewport (no guide, no empty
attention panel).

### 4. Establish a font-size token scale and migrate Identity Map CSS — `Chore`, Medium

`identityMap.css` uses **15 distinct font sizes** (vs Import's 9), including a
full parallel half-pixel scale (9.5/10.5/12.5/13.5/14.5/15.5px). Four rules sit
at **9.5px** — below the documented 10px floor and the 11px `.label-tracked`
standard (`.roles-sub-eyebrow:1282`, `.inspector-eyebrow:1931`,
`.inspector-prompt-label:1958`, `.inspector-proposal-header:2479`). Root cause:
the token system defines only `--text-2xs` (11px) and `--text-sm` (14px), and
**neither is used anywhere in the identity CSS** — so there is no scale to snap
to and every size is hardcoded.

**Fix:** define a `--text-*` scale in `index.css` (e.g. `xs`/`sm`/`base`/`lg`/
`xl`); migrate `identityMap.css` (and `identity.css`) onto it; remove the
half-pixel sizes; lift the 9.5px eyebrows to the 11px floor.

**Acceptance:** identity CSS reads font-size from tokens; no sub-10px or
half-pixel font sizes remain; distinct size count materially reduced.

### 5. Reconcile the Identity workspace aesthetic with the style guide — `Chore`, Medium

Both surfaces carry decorative hero imagery (`identity.css:41`
`.identity-import-hero`; the Map guide hero background at `identityMap.css:248`)
and gradients (5 in `identity.css`, 1 in `identityMap.css`), against a guide
that says *"No gradients… no decorative elements… No illustrations."*

**Decision (made):** keep the decorative headers — they are intentional. This
issue updates `docs/development/ui/facet-style-guide.md` to carve out a clean
exception: decorative, `aria-hidden`, content-quieting hero treatments are
permitted in the Identity workspace headers (and any future onboarding-heavy
surface), with the constraints that kept them tasteful (low opacity, fade mask,
no competing with content). Code and doctrine should agree.

**Acceptance:** the style guide documents the decorative-header exception with
its constraints; no further code change required.

### 6. Polish the Import review step — `Feature`, Low

Two enhancements to the extraction-review flow:
- **Bulk-accept in ScanReviewPane** for large resumes — the current master/
  detail, one-bullet-at-a-time review is thorough but slow at scale.
- **Clarify the "Deepen all bullets" → "Generate Draft" sequencing** — Deepen is
  a recommended-but-manual step gating a good draft
  (`ExtractionAgentCard.tsx:752`); make the "why this first" explicit or
  reduce the friction.

**Acceptance:** reviewers can accept extracted items in bulk; the Deepen-before-
Generate relationship is self-explanatory in the UI.

## Sequencing

The three High items are independent and can start immediately:
- **#1** and **#2** are quick CSS-token fixes (highest value-to-effort).
- **#3** is a disclosure/markup change.

**#4** (font-size tokens) is foundational debt but blocks nothing — schedule
after the High bugs. **#5** is a doc-only change. **#6** is a Low enhancement,
last.

No hard `blocked-by` edges; `gh seq --repo atlas-crew/Facet --order-by Priority`
will surface the High trio first.

## Preserve (do not regress)

- The deep-link bridge (`?sel/?focus/?return`, honor-once forward/reverse sync).
- The 6-hue band-rail content-typing (complete it to 7 via #1).
- The derivation-graph guidance (Next action / Needs attention / Potentially
  stale) — the value is real; #3 only fixes its placement weight.
- Import's morphing primary-action state machine and self-hiding onboarding —
  the pattern #3 ports to the Map.
