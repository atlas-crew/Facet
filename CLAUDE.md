# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important Notes

- We are pre-launch without users. You do not have to worry about backwards compatibility when making plans or suggestions.

## Reference Materials

Personal reference artifacts (job-search reports, prep transcripts, prior-engagement source material) live in the basic-memory vault at `main/facet/ref-materials`, not in this repo. Query them via the basic-memory MCP server when context from past job-search runs would inform an answer.

## Project Overview

Facet is a strategic resume assembly tool for senior engineers. Users define their career as a library of tagged, prioritized **components** and define **vectors** (positioning angles like "Backend Engineering", "Security Platform"). The app assembles the optimal resume for each angle, respecting page budgets.

## Commands

```bash
npm run dev          # Start Vite dev server
npm run build        # TypeScript check + Vite production build
npm run typecheck    # TypeScript only (no emit)
npm run test         # Run all Vitest tests
npx vitest run src/test/assembler.test.ts  # Run a single test file
npm run lint         # ESLint
```

Tests use Vitest with jsdom. No separate vitest config file — configuration is inline via Vite. Test files live in `src/test/`.

### Component Override System

Overrides use a hierarchical key system defined in `src/utils/componentKeys.ts`. A bullet's override keys resolve in order: `role:{roleId}:bullet:{bulletId}` → `role:{roleId}:{bulletId}` → `bullet:{bulletId}` → `{bulletId}`. The assembler's `buildComponentKeys()` generates these keys and `resolveManualOverride()` walks them.

- **`uiStore`** — Holds UI state: selected vector, panel ratio, manual overrides, variant overrides, and bullet orders. All keyed by vector so each vector has independent override state. Key: `vector-resume-ui`.

### Type System

`src/types.ts` defines the complete domain model. Key distinctions:

- **Component types** (`TargetLineComponent`, `RoleBulletComponent`, etc.) — raw data with `PriorityByVector` maps
- **Assembled types** (`AssembledTextComponent`, `AssembledRoleBullet`, etc.) — post-assembly with resolved single `IncludedPriority`
- **Template types** (`src/templates/types.ts`) — simplified render-ready data with no priority/vector metadata

Priority levels: `must` > `strong` > `optional` > `exclude`. Components can carry per-vector text variants via `TextVariantMap`.

### Templates & Rendering

Templates implement the `ResumeTemplate` interface. Currently one template: "Editorial Dense" (`src/templates/editorialDense.ts`) which generates DOCX via the `docx` library. The `docxRenderer` is dynamically imported in `App.tsx` to keep the main bundle small.

Additional renderers: `textRenderer.ts` (plain text) and `markdownRenderer.ts` (clipboard).

### Routing & App Shell

The app uses **TanStack Router** (code-based) with three routes:

- `/build` — Resume assembly workspace (the original Facet SPA)
- `/pipeline` — Job search pipeline tracker (in development)
- `/prep` — Interview prep reference cards (in development)

The root route renders `AppShell` (`src/components/AppShell.tsx`) which provides:

- A 48px icon sidebar for navigation between routes
- Global appearance/theme management
- The app footer
- An `<Outlet />` for child route content

Router config lives in `src/router.tsx`. Route components live in `src/routes/{name}/`.

See `docs/PIPELINE_PREP_SPEC.md` for the full architecture spec covering Pipeline and Prep feature implementation, data models, store design, component breakdown, and integration points.

### UI Layout (Build Route)

Two-panel split: Component Library (left, ~45%) | Live Preview (right, ~55%) with a draggable splitter. Vector selector bar at top, status bar at bottom showing page usage. The split ratio is persisted in `uiStore`.

### JD Analyzer

`src/utils/jdAnalyzer.ts` sends job descriptions to an external Claude API proxy (configured via `VITE_ANTHROPIC_PROXY_URL` env var) for analysis. Returns vector recommendations, bullet priority adjustments, target line suggestions, and skill gap analysis.

### Presets

Presets snapshot the current override state (manual overrides, variant text selections, bullet orders, priority overrides) for a given vector. Stored in `ResumeData.presets` and managed through `src/utils/presets.ts`.

## Conventions

- **Strict TypeScript** with `verbatimModuleSyntax` — use `import type` for type-only imports
- **No vitest globals** — always import `describe`, `it`, `expect` from `vitest`
- **Immutable state updates** — Zustand stores use spread/map patterns, never mutate in place (except `pageBudget.ts` which clones first then mutates the clone)
- **CSS custom properties** for all colors, spacing, and typography — see `docs/development/STYLE_GUIDE.md` for the design system
- **4px spacing grid** — all spacing values are multiples of 4
- **Geist Sans / Geist Mono** font stack
- Drag-and-drop via `@dnd-kit`
- Icons from `lucide-react`
