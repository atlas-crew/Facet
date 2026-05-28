# Facet Domain Model

Reference for the domain concepts that drive Facet's resume assembly. Read the section that maps to your task; you do not need to read the whole document linearly.

This file replaces the `### Component Override System / Type System / Templates & Rendering / Routing & App Shell / UI Layout / JD Analyzer / Presets` subsections previously inlined in `CLAUDE.md`. `CLAUDE.md` (and `AGENTS.md`) now link here for detail.

---

## Component Override System

Overrides use a hierarchical key system defined in `src/utils/componentKeys.ts`. A bullet's override keys resolve in order:

1. `role:{roleId}:bullet:{bulletId}`
2. `role:{roleId}:{bulletId}`
3. `bullet:{bulletId}`
4. `{bulletId}`

The assembler's `buildComponentKeys()` generates these keys and `resolveManualOverride()` walks them. Each level beats the next; the first match wins.

**`uiStore`** holds UI state: selected vector, panel ratio, manual overrides, variant overrides, and bullet orders. All keyed by vector so each vector has independent override state. Storage key: `vector-resume-ui`.

---

## Type System

`src/types.ts` defines the complete domain model. The key distinctions:

- **Component types** (`TargetLineComponent`, `RoleBulletComponent`, etc.) — raw data with `PriorityByVector` maps.
- **Assembled types** (`AssembledTextComponent`, `AssembledRoleBullet`, etc.) — post-assembly with a resolved single `IncludedPriority`.
- **Template types** (`src/templates/types.ts`) — simplified render-ready data with no priority/vector metadata.

**Priority levels:** `must` > `strong` > `optional` > `exclude`. Components can carry per-vector text variants via `TextVariantMap`.

The three tiers exist to keep raw data, assembly logic, and rendering decoupled. Do not collapse them — assembled types should not leak back into raw data, and template types should not leak priority/vector metadata.

---

## Templates & Rendering

Templates implement the `ResumeTemplate` interface. Currently one template ships: **"Editorial Dense"** (`src/templates/editorialDense.ts`), which generates DOCX via the `docx` library. The `docxRenderer` is dynamically imported in `App.tsx` to keep the main bundle small.

Additional renderers:

- `textRenderer.ts` — plain text export
- `markdownRenderer.ts` — clipboard-friendly markdown

When adding a new template, implement the `ResumeTemplate` interface and register it where existing templates are wired in. Heavy renderers should follow the dynamic-import pattern.

---

## Routing & App Shell

The app uses **TanStack Router** (code-based routing). The current route surface:

**Job search workflow**

- `/identity` — Identity model workspace (Phase 0; feeds every other workspace).
- `/research` — AI-driven opportunity discovery; bulk-imports to Pipeline.
- `/pipeline` — Central tracker for every job opportunity.
- `/match` — Match analysis: identity vs. JD; produces match reports.
- `/build` — Identity-first resume assembly workspace (the original Facet SPA).
- `/letters` — Cover letter drafting from match reports / pipeline entries.
- `/linkedin` — LinkedIn profile content generator.
- `/recruiter` — One-page recruiter pitch cards.
- `/prep` (and `/prep/live`) — Interview prep decks; live cheatsheet during interviews.
- `/debrief` — Post-interview capture and pattern surfacing.

**Account & infrastructure**

- `/home` — Dashboard hub.
- `/account` — Account settings, hosted entitlements, AI access status.
- `/help` — In-app help docs.
- `/terms` and `/privacy` — Hosted legal pages.

The root route renders `AppShell` (`src/components/AppShell.tsx`) which provides:

- A 48px icon sidebar for navigation between routes.
- Global appearance/theme management.
- The app footer.
- An `<Outlet />` for child route content.

Router config lives in `src/router.tsx`. Route components live in `src/routes/{name}/`.

See `docs/reference/feature-reference.md` for the current route and feature
inventory. The pre-implementation Pipeline/Prep spec was archived at
`docs/archive/PIPELINE_PREP_SPEC.md`; current ownership boundaries live in
`docs/architecture/facet-workspace-topology.md` and
`docs/architecture/identity-canonical-data.md`.

---

## UI Layout (Build Route)

Two-panel split: **Component Library** (left, ~45%) and **Live Preview** (right, ~55%) with a draggable splitter. A vector selector bar sits at the top; a status bar at the bottom shows page usage. The split ratio is persisted in `uiStore`.

---

## JD Analyzer

JD analysis now flows through the shared JDAnalysis model and supporting utilities
such as `src/utils/jdAnalysis.ts`, `src/utils/jobMatch.ts`, and
`src/utils/buildProjection.ts`. AI-backed analysis uses the configured proxy
endpoint (`VITE_ANTHROPIC_PROXY_URL`) when generation is available. The analysis
surface returns:

- Vector recommendations
- Bullet priority adjustments
- Target line suggestions
- Skill gap analysis

Treat the proxy as an external boundary — validate at the seam, don't trust shape.

---

## Presets

Presets snapshot the current override state — manual overrides, variant text selections, bullet orders, and priority overrides — for a given vector. They are stored in `ResumeData.presets` and managed through `src/utils/presets.ts`.

Saving a preset captures the vector's current effective state; restoring replays it. Presets are vector-scoped, so a preset saved against one vector does not apply to another.
