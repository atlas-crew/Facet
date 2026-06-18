# Facet UI Primitives

The bounded primitive layer. Presentational, token-styled, prop-driven
components shared across workspaces — `Button`, `SectionLabel`, `StatusBadge`,
and any future primitive that clears the style guide's extraction gate.

This layer exists because convention-only consistency fragmented at ~8
workspaces (49 forked button classes, 15 eyebrow classes, …). See
[adr-0011](../../../docs/architecture/decisions/adr-0011-extract-ui-primitive-layer.md)
and the
[rollout plan](../../../docs/development/plans/ui-primitive-consolidation-rollout-plan.md)
(milestone M12).

**This is not a general component dump.** App-coupled feature components stay in
`src/components/` and `src/routes/`. A component earns a place here only by
clearing the four-condition gate in the
[style guide](../../../docs/development/ui/facet-style-guide.md)
(§"When to extract a React primitive").

## Authoring rules

1. **Presentational only.** No imports from `src/store`, `src/engine`, routing,
   or any workspace. A primitive takes props and renders; it holds no app
   state. This is what keeps it composable and reusable across every workspace.
2. **Variants via props, never class forks.** A new visual variation is a prop
   value (`<Button variant="danger">`), reviewed against the documented set —
   not a new `.{workspace}-btn-*` class. Re-forking is the exact failure this
   layer corrects. The one exception is a genuinely *contextual* value that
   isn't a fixed variant (e.g. a parent-provided `--band-color` on an identity
   eyebrow): pass it via `style`, which overrides the tone class — don't add a
   tone per context.
3. **Style from tokens.** Colors, spacing, typography, and radius come from the
   CSS custom properties in `src/index.css`. No hardcoded hex, no off-grid
   spacing (4px grid), radius from the 4/6/8px scale. Colocate styles in a
   same-named CSS file imported by the component (`Button.tsx` + `button.css`,
   matching the repo's camelCase CSS-filename convention, e.g. `fillBar.css`).
4. **API derived from real usage.** When extracting, build the prop matrix by
   auditing the existing forked implementations, not from imagination — this is
   the gate's condition #2. (The `Button` contract, for example, comes from the
   49 existing button classes; see the rollout plan.)
5. **Barrel export.** Re-export every primitive from `index.ts` so callers
   import from `'.../components/ui'`.
6. **Accessibility baseline.** Native semantics (`<button>`, not
   `<div onClick>`), a visible focus state, and ARIA for stateful variants
   (`aria-pressed` for toggles, `aria-disabled`, etc.).
7. **Tested.** Each primitive ships a unit test of its variant/size/state matrix
   in `src/test/` (e.g. `src/test/Button.test.tsx`), per the repo's test layout.

## Adding a primitive

1. Audit the existing forked implementations → derive the prop matrix (rule 4).
2. Implement in `src/components/ui/` following the rules above.
3. Colocate the token-only CSS; export from `index.ts`.
4. Add the matrix test in `src/test/`.
5. Migrate callers and delete the forked CSS **in a separate issue** — keep
   extraction and migration as distinct, bisectable commits.
