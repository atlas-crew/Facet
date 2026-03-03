# Facet Feature Reference (Current)

## Purpose
This document reflects the currently shipped feature surface in Facet and points to the primary implementation files.

## Scope
Current production-facing capabilities:
- JSON import/export with replace and merge flows
- Per-vector bullet ordering and reset controls
- Skill group vector routing (priority, order, optional content override)
- Typst-powered PDF rendering, preview, and download (DOCX removed)
- Theme system: presets, token overrides, visual preset gallery, and density step controls
- Saved variants with dirty-state tracking
- JD analysis with selective apply and variant save
- Plain text and Markdown output actions

## Feature Behavior

### 1) JSON Import/Export
- Import supports text paste and file upload.
- Validation reports schema issues with actionable errors.
- Import mode supports `Replace All` and `Merge`.
- Merge preserves existing content where possible and adds new content by id.
- Export produces a round-trippable JSON payload.

Primary files:
- `src/components/ImportExport.tsx`
- `src/engine/importMerge.ts`
- `src/engine/serializer.ts`
- `src/App.tsx`

### 2) Per-Vector Bullet Ordering
- Bullet order is stored per vector with a default fallback.
- Reordering in one vector does not reorder other vectors.
- UI shows custom-order indicators and reset controls.
- Global and per-role reset actions clear vector-specific order overrides.

Primary files:
- `src/utils/bulletOrder.ts`
- `src/store/uiStore.ts`
- `src/components/BulletList.tsx`
- `src/components/ComponentLibrary.tsx`
- `src/engine/assembler.ts`

### 3) Skill Group Vector Routing
- Skill groups support per-vector priority, order, and optional content override.
- Assembly uses vector-specific settings with fallback behavior.
- Editor UI exposes default and per-vector controls.

Primary files:
- `src/utils/skillGroupVectors.ts`
- `src/components/SkillGroupList.tsx`
- `src/engine/assembler.ts`
- `src/engine/serializer.ts`
- `src/types.ts`

### 4) PDF Rendering (Typst)
- Resume output is rendered directly to PDF with Typst WASM.
- Preview shows the actual rendered PDF (WYSIWYG) in an iframe.
- Download uses the last rendered blob and names files as `{Name}_Resume_{Vector}.pdf`.
- PDF metadata and link rendering are generated from assembled resume data.
- Bundled fonts are loaded lazily and embedded for consistent rendering.

Primary files:
- `src/utils/typstRenderer.ts`
- `src/templates/resume.typ`
- `src/hooks/usePdfPreview.ts`
- `src/components/PdfPreview.tsx`
- `src/utils/pdfFormatting.ts`

### 5) Theme System
- Theme preset picker plus per-token overrides (fonts, sizes, spacing, margins, colors, layout).
- Visual preset gallery shows mini style previews and click-to-apply cards.
- Density controls provide one-step global spacing updates (`Tighten` / `Loosen`).
- Presets include:
  - `ferguson-v12`
  - `clean-modern`
  - `classic-serif`
  - `minimal`
  - `editorial`
  - `executive-serif`
  - `modern-contrast`
  - `signal-clean`
- Theme font options include Inter, DM Sans, Source Serif 4, PT Serif, IBM Plex Sans, IBM Plex Serif, Newsreader, and DM Mono.

Primary files:
- `src/themes/theme.ts`
- `src/components/ThemeEditorPanel.tsx`
- `src/App.tsx`
- `src/index.css`

### 6) Presets
- Users can save, load, and delete named presets.
- Loading restores selected vector and associated override state.
- Dirty-state indicator shows divergence from the active preset.
- Presets persist and round-trip via JSON import/export.

Primary files:
- `src/hooks/usePresets.ts`
- `src/utils/presets.ts`
- `src/App.tsx`
- `src/engine/serializer.ts`
- `src/engine/importMerge.ts`

### 7) JD Analysis
- Users can paste job descriptions and run analysis via configured endpoint.
- Results support selective apply (vector, target line, and bullet-level priority changes).
- Applied analysis can be saved as a new preset.
- Missing/invalid endpoint and request errors degrade gracefully.

Primary files:
- `src/utils/jdAnalyzer.ts`
- `src/App.tsx`
- `src/components/StatusBar.tsx`

### 8) Text Outputs
- Plain text and Markdown outputs are generated from assembled resume data.
- These serve as fallback export formats for form fill and docs workflows.

Primary files:
- `src/utils/textRenderer.ts`
- `src/utils/markdownRenderer.ts`
- `src/App.tsx`

## Data Model Notes
- `ResumeData.theme?: ResumeThemeState`
- `ResumeData.presets?: Preset[]`
- `PresetOverrides` include manual overrides, variant overrides, bullet ordering, optional priority overrides, and optional theme snapshot.
- Skill groups support vector-specific config (`priority`, `order`, optional `content`).
- Assembly result includes integer page estimates and fractional usage for budget threshold UI.

## Runtime Configuration
- JD analysis is enabled via `VITE_ANTHROPIC_PROXY_URL`.
- Endpoint must be valid HTTP/HTTPS.
- Embedded credentials in endpoint URLs are rejected.

## Verification
Run:

```bash
npm run typecheck
npm run test
npm run build
```

Optional full check:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Test Coverage Pointers
- `src/test/typstRenderer.test.ts`
- `src/test/usePdfPreview.test.tsx`
- `src/test/theme.test.ts`
- `src/test/ThemeEditorPanel.test.tsx`
- `src/test/jdAnalyzer.test.ts`
- `src/test/importMerge.test.ts`
- `src/test/serializer.test.ts`
