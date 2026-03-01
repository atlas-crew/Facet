# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vector Resume is a strategic resume assembly tool for senior engineers. Users define their career as a library of tagged, prioritized **components** and define **vectors** (positioning angles like "Backend Engineering", "Security Platform"). The app assembles the optimal resume for each angle, respecting page budgets.

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

## Architecture

### Data Flow

```
ResumeData (YAML/JSON) → resumeStore (Zustand, persisted) → assembler → AssemblyResult → renderers
                                                              ↑
                                                  uiStore (vector selection, overrides, bullet orders)
```

The assembly pipeline is the core of the app:

1. **`src/engine/serializer.ts`** — Parses and validates YAML/JSON resume configs into `ResumeData`. Handles import/export with strict shape validation and auto-creates missing vectors from component references.

2. **`src/engine/assembler.ts`** — The central engine. Takes `ResumeData` + `AssemblyOptions` (selected vector, manual overrides, variant overrides, bullet ordering) and produces an `AssemblyResult`. Resolves per-vector priorities, applies manual inclusion/exclusion overrides, picks text variants, and sorts bullets by priority rank.

3. **`src/engine/pageBudget.ts`** — Estimates resume length in lines/pages (heuristic: 58 lines/page, 92 chars/line). Trims lowest-priority bullets from the bottom of the last role when over budget. Returns warnings for must-only overflow.

4. **`src/engine/importMerge.ts`** — Merges imported data into existing data by ID (additive only, never replaces existing items).

### State Management

Two Zustand stores, both persisted to localStorage:

- **`resumeStore`** — Holds the canonical `ResumeData` (components, vectors, metadata, saved variants). Key: `vector-resume-data`.
- **`uiStore`** — Holds UI state: selected vector, panel ratio, manual overrides, variant overrides, and bullet orders. All keyed by vector so each vector has independent override state. Key: `vector-resume-ui`.

### Component Override System

Overrides use a hierarchical key system defined in `src/utils/componentKeys.ts`. A bullet's override keys resolve in order: `role:{roleId}:bullet:{bulletId}` → `role:{roleId}:{bulletId}` → `bullet:{bulletId}` → `{bulletId}`. The assembler's `buildComponentKeys()` generates these keys and `resolveManualOverride()` walks them.

### Type System

`src/types.ts` defines the complete domain model. Key distinctions:
- **Component types** (`TargetLineComponent`, `RoleBulletComponent`, etc.) — raw data with `PriorityByVector` maps
- **Assembled types** (`AssembledTextComponent`, `AssembledRoleBullet`, etc.) — post-assembly with resolved single `IncludedPriority`
- **Template types** (`src/templates/types.ts`) — simplified render-ready data with no priority/vector metadata

Priority levels: `must` > `strong` > `optional` > `exclude`. Components can carry per-vector text variants via `TextVariantMap`.

### Templates & Rendering

Templates implement the `ResumeTemplate` interface. Currently one template: "Editorial Dense" (`src/templates/editorialDense.ts`) which generates DOCX via the `docx` library. The `docxRenderer` is dynamically imported in `App.tsx` to keep the main bundle small.

Additional renderers: `textRenderer.ts` (plain text) and `markdownRenderer.ts` (clipboard).

### UI Layout

Two-panel split: Component Library (left, ~45%) | Live Preview (right, ~55%) with a draggable splitter. Vector selector bar at top, status bar at bottom showing page usage. The split ratio is persisted in `uiStore`.

### JD Analyzer

`src/utils/jdAnalyzer.ts` sends job descriptions to an external Claude API proxy (configured via `VITE_ANTHROPIC_PROXY_URL` env var) for analysis. Returns vector recommendations, bullet priority adjustments, target line suggestions, and skill gap analysis.

### Saved Variants

Variants snapshot the current override state (manual overrides, variant text selections, bullet orders, priority overrides) for a given vector. Stored in `ResumeData.saved_variants` and managed through `src/utils/savedVariants.ts`.

## Conventions

- **Strict TypeScript** with `verbatimModuleSyntax` — use `import type` for type-only imports
- **No vitest globals** — always import `describe`, `it`, `expect` from `vitest`
- **Immutable state updates** — Zustand stores use spread/map patterns, never mutate in place (except `pageBudget.ts` which clones first then mutates the clone)
- **CSS custom properties** for all colors, spacing, and typography — see `docs/development/STYLE_GUIDE.md` for the design system
- **4px spacing grid** — all spacing values are multiples of 4
- **Geist Sans / Geist Mono** font stack
- Drag-and-drop via `@dnd-kit`
- Icons from `lucide-react`
