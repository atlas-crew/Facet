# Facet

Facet is a strategic resume assembly tool that lets you define one reusable career component library and generate targeted resumes by selecting a positioning vector.

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Scripts

- `npm run dev` — start local dev server
- `npm run typecheck` — run TypeScript checks
- `npm run test` — run unit tests (Vitest)
- `npm run build` — create production build

## MVP Features Implemented

- Vector definitions with color-coded selection bar
- Component library for target lines, profiles, skill groups, role bullets, and projects
- Vector-tagged priority-based assembly (`must`, `strong`, `optional`, `exclude`)
- Variant selection during assembly (vector-specific text fallback to default)
- Variant switching controls in UI (`Auto` / `Default` / explicit variant) per active vector
- Manual include/exclude overrides per vector
- Bullet drag-and-drop ordering (persisted per selected vector)
- Skill group reordering controls
- Page budget estimation + trimming strategy (optional/strong from oldest roles first)
- Live PDF resume preview rendered via Typst (WYSIWYG with download output)
- PDF generation with embedded bundled fonts (theme-aware)
- Plain-text and Markdown renderers (clipboard actions)
- YAML/JSON import/export with schema validation
- localStorage persistence for resume data and UI state
