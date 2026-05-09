# Brand Changelog

What changed in the brand library and when. Public-surface audits, vocabulary updates, structural reorganizations, retired assets — all anchored here so future drift is measurable against a known-good baseline.

When you make a substantive brand change, append an entry with the date and what changed. Format: `## YYYY-MM-DD · {short title}` followed by a paragraph and bullet list.

For voice and register guidance, see [`COPY.md`](COPY.md). For library navigation, see [`README.md`](README.md).

---

## 2026-05-08 · designer-facing artifacts (poster + swatch sheet)

Added two new brand surfaces aimed at external designer handoff and the press kit. Differentiated from the existing `reference.html` (which is screen-friendly internal team reference): the new artifacts are letter-sized print-ready and have no exploration material.

- **`_source/html/poster.html`** — letter portrait (1224×1584 at 144 DPI). Single-page brand summary: wordmark hero, brand-blue palette (7 swatches with hex), surface + status colors, four-font typography reference with usage roles, locked phrases card (hero / trust / close), footer (domain / repo / press / license). Dark + light variants — dark for screen sharing, light for print. Renders via `just brand-poster`.
- **`_source/html/swatch.html`** — letter landscape (1584×1224 at 144 DPI). Standard designer-kit reference: lockup specimens (hero / app / on-dark / mono / gem-only), color swatches (brand blues + surfaces + status), typography specimens (4 cards, font + weight range + role). Light-bg only (print-default). Renders via `just brand-swatch`.
- **Press kit copy.** `brand/press/swatch/facet-swatch.png` lives alongside `hero/` and `logos/` so journalists and external designers grab it via the press URL. PNG is intentional — universally consumable, prints clean.
- **Pipeline wiring.** New `brand-poster` and `brand-swatch` recipes wired into the `brand:` umbrella. New `brand-clean-poster` and `brand-clean-swatch` follow the per-category enumerate-and-delete pattern (matching the safety convention from the 2026-05-08 cleanup-safety entry below). Both new categories appear in `brand-webp-clean` chain.
- **press/README.md** updated with a "Designer reference" section pointing at `swatch/`.

**Two minor render fixes after first pass:**
- Poster swatch row: 7 brand-blue swatches at 152px wrapped onto two rows; tightened to 138px so all 7 sit in a single horizontal palette band.
- Poster typography meta labels were inheriting browser-default black on the dark variant, rendering invisible against `#0a0c10`. Added explicit `#5ba4d9` (dark) and `#475569` (light) color rules.

## 2026-05-08 · move HTML sources to `_source/html/`, scope cleanup recipes safely

Reorganized the brand source layout to live alongside other source formats and made the cleanup recipes safe against Adobe Illustrator exports.

- **Source directory move.** `brand/sheets/*.html` → `brand/_source/html/*.html`. All 23 HTML source files plus the `_archive/` subfolder. Sibling `brand/_source/ai/` already existed for Adobe Illustrator sources; the new layout lets future source formats join naturally (`_source/figma/`, etc.).
- **justfile path updates.** ~20 path references updated from `brand/sheets/` to `brand/_source/html/`. Verified end-to-end with `just brand-readme`.
- **Cleanup safety.** Replaced `rm -rf brand/exports/{category}` (the previous unsafe pattern) with per-category enumerate-and-delete recipes. Adobe Illustrator exports at `brand/exports/social/facet-beam-striking-crystal-social.webp` and `brand/exports/hero/facet-beam-striking-crystal.webp` share the `facet-*` prefix and would have been silently wiped on `brand-clean`. The new pattern: each render category has a matching `brand-clean-{cat}` recipe that enumerates exactly what its `brand-{cat}` partner produces. Top-level `brand-webp-clean` chains them. Adding a new render category requires adding a matching cleanup recipe.
- **BRAND.md, COPY.md, GLOSSARY.md, press/README.md** — path references updated to `brand/_source/html/`. Inventory tree restructured to show the new hierarchy.
- **Quick-reference docs added.** `README.md`, `CHEATSHEET.md`, `CLAUDE.md`, `RECIPES.md`, and this `CHANGELOG.md` itself. The audit log content previously embedded in COPY.md was extracted to this file; COPY.md now points at this file as the canonical history.

## 2026-05-05 · public-surface audit (post-vocabulary lock)

Sweep of public-facing assets after locking the new hero, trust line, and `recut` brand verb. Caught vocabulary drift from the pre-lock language and stripped versioning leaks from public chrome.

- **Em-dash policy** — added carve-out: display copy may use connective em dashes; long-form prose avoids (was a blanket "avoid" before). See "Voice and register" in COPY.md.
- **Twitter/GitHub banner subtitle** — changed from "Open-source career platform · Identity extraction · Level correction" → "Open-source · Recut for every opportunity · Your data, never ours". Old subtitle violated the "what NOT to use" list (`career platform`) and used the retired "Level correction" phrase.
- **V3 versioning** — stripped from `promo.html`, `story.html`, `editorial.html` headers (all changed to "Open-source"). Kept on `system.html` since it's a dev-audience concept sheet where version metadata is appropriate register.
- **Principle thesis sub-line** — capitalized "Resumes, Letters, Prep" (matches module taxonomy proper-noun convention).
- **Promo badge** — swapped "● NOW AVAILABLE" → "● OPEN SOURCE" (permanent fixture instead of launch-window-only language; badge frame is good visual real estate, shouldn't decay post-launch).
- **Social composite** — increased container height 1900px → 2000px to fit the bottom square caption row (square-dark / square-light filename labels were clipping).

**Known-deferred:** `og-image-light` phone-contrast verification (can't auto-test).

## 2026-05-05 · module-taxonomy sweep

Aligned brand assets with the new module taxonomy (Pipeline → Track, Build → Resume) ahead of the product nav rename. Brand is now leading product on this naming; product sidebar still uses old labels but is expected to follow.

- **`reference.html`** typography sample — module list updated: `Identity · Build · Match · Pipeline · Prep · Letters · LinkedIn · Recruiter · Debrief` → `Identity · Research · Match · Resume · Track · Prep · Letters · LinkedIn · Recruiter · Debrief`. Added `Research` (real route in product, was missing from brand list).
- **`system.html`** Career Operating System layer stack:
  - Layer 02 Workflow: `Pipeline · Prep · Debrief` → `Track · Prep · Debrief`
  - Layer 03 Inference: `Match · Build · Vector mapping` → `Match · Assembly · Vector mapping`. Used **Assembly** rather than Resume because Layer 03 is inference engines, not output artifacts; Resume belongs in Layer 01 Outputs (already there as "Resumes"). See "Engine vs module" note in Module taxonomy.
  - Header comment block updated with new module list.
- **`COPY.md`** Module taxonomy — added Research; added Engine vs module note distinguishing **Assembly** (engine) from **Resume** (module/artifact); rewrote the "Naming in flux" disclaimer to reflect brand-leads-product state.

**False positives (no change):** `carousel.html`, `promo.html`, and `principle.html` use "Build" as a verb ("Build the model once", "Build it once. Recut forever.") — these are correct usages and remain unchanged. `identity.html` uses lowercase artifact descriptions ("resumes, letters, LinkedIn, recruiter cards"), also fine.
