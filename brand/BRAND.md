# Facet Brand Reference

> **New here?** Start at [`README.md`](README.md) for the library
> navigator. For the 30-second lookup, see [`CHEATSHEET.md`](CHEATSHEET.md).
> For chronological history, see [`CHANGELOG.md`](CHANGELOG.md).
>
> **Looking for taglines, hero copy, or "how should I write this"?**
> See [`COPY.md`](COPY.md) — the language reference. This doc handles
> visual brand (marks, colors, typography, asset library).
>
> **Looking for the long-form positioning argument?** See
> [`MANIFESTO.md`](MANIFESTO.md) — the source-of-truth document for
> anti-auto-apply, Live-as-open-notebook, episodic pricing, and the
> data-ownership stance. Public URL pending (`myfacets.cv/manifesto`).
>
> **Looking for reusable founder/company bios or social profile copy?**
> See [`BIOS.md`](BIOS.md) — three-size founder bio, three-size company
> boilerplate, and platform-specific social profile bios all calibrated
> to the locked vocabulary.
>
> **AI agent editing brand files?** See [`CLAUDE.md`](CLAUDE.md) for
> directory-local rules.

## Marks

### Gem Mark (primary icon)
Shield-cut gem silhouette. Flat crown, long pavilion, clean facet geometry.
Two-tone blue split carries the brand identity. Used as the standalone app
icon: sidebar, favicon, og:image, app store, README.

Files: `brand/icons/svg/facet-gem.svg` (default), `facet-gem-active.svg` (bright), `facet-gem-on-light.svg` (light backgrounds). High-res raster equivalents in `brand/icons/png/`.
Component: `src/components/FacetWordmark.tsx → FacetGemMark`

### Wordmark Lockup
Gem mark + "Facet" in Instrument Serif 400. The serif's thin/thick
stroke contrast mirrors the gem's two-tone split. Used on GitHub
banner, landing page, and hero contexts. Never use the wordmark at
small sizes — switch to the gem mark alone below 32px.

**Contextual weight adjustment.** Instrument Serif is a display face
and its strokes can read thin against bold UI elements at small sizes.
When the wordmark sits next to a heavy sans-serif heading (like an app
header), bump the weight slightly to keep optical balance. Rule of thumb:

| Context                          | Weight |
|----------------------------------|--------|
| Hero, banner, landing (≥48px)   | 400    |
| App header, nav (24–40px)        | 500    |
| Inline with bold UI text         | 500    |

The serif still reads as Instrument Serif at 500 — it just stops
looking spindly next to a 700-weight neighbor. This is an optical
correction, not a brand variant.

Component: `src/components/FacetWordmark.tsx → FacetWordmark`

---

## Color System

### Brand Blues (the two-tone identity)

**Primary brand blue: `#2d6a96`** — the single canonical Facet color.
Used as light-mode accent, gem crown on light backgrounds, and the
dominant shadow face of the gem on dark. When in doubt, use this one.

| Token              | Hex       | Usage                                   |
|--------------------|-----------|-----------------------------------------|
| `gem-light`        | `#6cb8e8` | Light face, active accent, hover state  |
| `gem-dark`         | `#2d6a96` | Shadow face, dark-mode accent primary   |
| `gem-mid`          | `#4a94c8` | Pavilion right (active gem)             |
| `gem-highlight`    | `#7ac4f0` | Edge highlights, cut lines, glow        |
| `accent-primary`   | `#5ba4d9` | Default accent (dark theme)             |
| `accent-hover`     | `#6cb8e8` | Hover state (same as gem-light)         |

### Dark Theme

| Token              | Hex       | Usage                                   |
|--------------------|-----------|-----------------------------------------|
| `bg-primary`       | `#0a0c10` | Page background                         |
| `bg-surface`       | `#12151c` | Cards, panels                           |
| `bg-surface-hover` | `#171b24` | Hover state on surfaces                 |
| `bg-inset`         | `#0e1117` | Recessed areas                          |
| `border-subtle`    | `#252a36` | Dividers, card borders                  |
| `border-default`   | `#303745` | Input borders                           |
| `text-primary`     | `#e8ecf2` | Body text                               |
| `text-secondary`   | `#c0c8d4` | Supporting text                         |
| `text-tertiary`    | `#6b7a8d` | Muted/disabled text                     |

### Light Theme

| Token              | Hex       | Usage                                   |
|--------------------|-----------|-----------------------------------------|
| `bg-primary`       | `#f8fafc` | Page background                         |
| `bg-surface`       | `#ffffff` | Cards, panels                           |
| `accent-primary`   | `#2d6a96` | Links, active states (gem-dark)         |

### Status Colors

| Token     | Dark        | Light       |
|-----------|-------------|-------------|
| `success` | `#3fbf8a`   | `#16a34a`   |
| `warning` | `#d8a34d`   | `#b45309`   |
| `error`   | `#f07178`   | `#dc2626`   |

---

## Typography

### App UI

| Context    | Family           | Weight  | Usage                              |
|------------|------------------|---------|------------------------------------|
| Body       | DM Sans          | 300-700 | All app text, labels, descriptions |
| Mono       | DM Mono          | 400-500 | Code, JSON, technical values       |
| Wordmark   | Instrument Serif | 400     | Wordmark lockup only               |
| Brand      | Outfit           | 200-700 | Hero text, landing page headings   |

### Resume Themes (output documents)

Separate from the app UI. Each resume theme defines its own font pair
from the theme font library. See `src/themes/theme.ts` for the full
list: Inter, DM Sans, Source Serif 4, PT Serif, IBM Plex Sans/Serif,
Newsreader, Nunito Sans, Libre Franklin, Lora, DM Mono.

---

## Tagline

**Same diamond · Different face**

Used in the GitHub banner and across all brand assets. Captures the
product thesis: one identity, many presentations. The diamond metaphor
connects to the gem mark.

---

## Hero copy (locked)

**Hero (typography-led):**
> A deep model of you, professionally. *Recut for every opportunity.*

**Social / ad version:**
> Stop rewriting yourself for every job. Build the model once, recut it
> for every opportunity.

### Why "recut" is brand vocabulary

`recut` is owned vocabulary — specifically Facet's verb. It connects
to the gem mark structurally (a jeweler recuts a stone) and to the
methodology (you recut a model, you don't rewrite it). Use it
consistently:

- ✅ "Recut your resume for this opportunity"
- ✅ "Recut for the JD"
- ✅ "Build once. Recut for each."
- ❌ "Tailor your resume" (generic — every resume tool says this)
- ❌ "Generate a custom resume" (Facet *refines*, doesn't generate)

The locked hero appears in: hero banners (bold), promo, OG image,
square card, story poster, principle thesis card. The version-meta
strings (`v3 · open source · self-hosted`) and concept sheet titles
(`Career Operating System`, etc.) stay as-is — those serve different
purposes.

---

## File Inventory

Source HTML lives in `_source/html/` (one consolidated file per graphic
type). Each sheet contains every variant of its type stacked
vertically, with each variant scoped to a unique element ID so it
can be screenshotted by selector. Rendered PNGs live in `exports/`
mirroring the same grouping.

```
brand/
├── BRAND.md                          ← this file (visual brand reference)
├── COPY.md                           ← language reference (locked vocabulary, voice, asset → phrase index)
├── MANIFESTO.md                      ← long-form positioning argument
├── PRICING.md                        ← public pricing argument ($299 / 90-day pass / 12-month window / 7-day refund)
├── BIOS.md                           ← reusable founder / company / social bios (3 sizes each)
├── FAQ.md                            ← canonical answers to predictable questions (10 Q&A)
├── GLOSSARY.md                       ← term definitions (recut, model, substrate, vector, pass, …)
├── TONE.md                           ← register-by-surface guide (support / release / tweet / blog / email)
├── press/                            ← press-kit folder (README + logos/ + hero/) — single URL for journalists / partners
├── _source/                          ← brand asset sources (HTML)
│   └── html/
│   │   ├── banners.html              ← #bold-dark · #bold-light · #atm-dark · #atm-light  (1200×630)
│   │   ├── editorial.html            ← #editorial-dark · #editorial-light  (1200×630, typography-led hero)
│   │   ├── social.html               ← #og-dark · #og-light (1200×630) · #twitter (1500×500) · #github (1280×320)
│   │   ├── square.html               ← #square-dark · #square-light  (1080×1080, IG/LinkedIn feed)
│   │   ├── email.html                ← #email-dark · #email-light  (1200×400 newsletter masthead)
│   │   ├── carousel.html             ← #carousel-1..5 + -light  (1080×1350, 5-slide diamond-centric deck)
│   │   ├── story.html                ← #story-dark · #story-light  (1080×1920 IG/Snap vertical)
│   │   ├── principle.html            ← #principle-{tagline,method,thesis}  (1080×1080 quote cards)
│   │   ├── promo.html                ← #promo-dark · #promo-light  (1200×630 launch banner)
│   │   ├── system.html               ← #system-dark · #system-light  (1200×630, "Career Operating System")
│   │   ├── identity.html             ← #identity-dark · #identity-light  (1200×630, "Professional Identity Model")
│   │   ├── extraction.html           ← #extraction-dark · #extraction-light  (1200×630, "Identity Extraction")
│   │   ├── iterative.html            ← #iterative-dark · #iterative-light  (1200×630, "Iterative Identity")
│   │   ├── vectors.html              ← #vectors-dark · #vectors-light  (1200×630, "Vector Mapping")
│   │   ├── episodic.html             ← #episodic-dark · #episodic-light  (1200×630, "Episodic by Design")
│   │   ├── substrate.html            ← #substrate-dark · #substrate-light  (1200×630, model substrate · Manifesto · 01)
│   │   ├── manifesto.html            ← #manifesto-dark · #manifesto-light  (1080×1350 portrait, "What Facet isn't" · Manifesto · 02)
│   │   ├── method.html               ← #method-dark · #method-light  (1600×900 widescreen, methodology one-pager · The Method · 01)
│   │   ├── readme.html               ← #readme-dark · #readme-light  (1280×640 2:1 banner, GitHub repo hero)
│   │   ├── reference.html            ← #refcard (brand card) · #fontcompare (wordmark exploration)
│   │   ├── lockups.html              ← #lockups-dark · #lockups-light  (1200×630, lockup specimens)
│   │   ├── poster.html               ← #poster-dark · #poster-light  (1224×1584 letter portrait, designer-handoff brand summary)
│   │   ├── swatch.html               ← #swatch  (1584×1224 letter landscape, designer reference: lockups · colors · type)
│   │   ├── composite.html            ← 12 per-category #composite-{cat} contact sheets
│   │   └── _archive/
│   │       └── loop.html             ← The Search Loop (retired — replaced by diamond-centric carousel)
├── exports/                          ← WebP-only (generated by `just brand`)
│   ├── concepts/                     ← 14 thesis-led concept variants (1200×630)
│   │   ├── facet-system-{dark,light}.webp         ← Career Operating System
│   │   ├── facet-identity-{dark,light}.webp       ← Professional Identity Model
│   │   ├── facet-extraction-{dark,light}.webp     ← Identity Extraction
│   │   ├── facet-iterative-{dark,light}.webp      ← Iterative Identity
│   │   ├── facet-vectors-{dark,light}.webp        ← Vector Mapping
│   │   ├── facet-episodic-{dark,light}.webp       ← Episodic by Design
│   │   └── facet-substrate-{dark,light}.webp      ← The model substrate (Manifesto · 01)
│   ├── banners/                      ← hero pieces (1200×630)
│   │   ├── facet-hero-bold-{dark,light}.webp       ← bold split (mood-led)
│   │   ├── facet-hero-atmospheric-{dark,light}.webp ← atmospheric vignette (mood-led)
│   │   └── facet-hero-editorial-{dark,light}.webp  ← typography-led quote
│   ├── social/                       ← channel-specific assets (mixed sizes)
│   │   ├── facet-og-image-{dark,light}.webp       ← 1200×630 link previews
│   │   ├── facet-twitter-banner.webp              ← 1500×500
│   │   ├── facet-github-banner.webp               ← 1280×320
│   │   └── facet-square-{dark,light}.webp         ← 1080×1080 IG/LinkedIn feed
│   ├── email/                        ← newsletter mastheads
│   │   └── facet-email-header-{dark,light}.webp   ← 1200×400 (display 600×200)
│   ├── carousel/                     ← multi-slide LinkedIn/IG portrait deck
│   │   ├── facet-carousel-{1..5}.webp             ← 1080×1350 dark (diamond-centric)
│   │   └── facet-carousel-{1..5}-light.webp       ← 1080×1350 light variants
│   ├── story/                        ← vertical mobile-first poster
│   │   └── facet-story-{dark,light}.webp          ← 1080×1920 IG Stories / Snap aspect
│   ├── principle/                    ← repostable quote cards
│   │   ├── facet-principle-{tagline,method,thesis}.webp       ← 1080×1080 dark
│   │   └── facet-principle-{tagline,method,thesis}-light.webp ← light variants
│   ├── promo/                        ← launch / promo banner
│   │   └── facet-promo-{dark,light}.webp          ← 1200×630 with "Open source" badge
│   ├── manifesto/                    ← anti-positioning portrait card (Manifesto · 02)
│   │   └── facet-manifesto-{dark,light}.webp      ← 1080×1350 "What Facet isn't"
│   ├── method/                       ← methodology one-pager (The Method · 01)
│   │   └── facet-method-{dark,light}.webp         ← 1600×900 widescreen 3-phase cycle
│   ├── readme/                       ← GitHub README hero
│   │   └── facet-readme-{dark,light}.webp         ← 1280×640 asymmetric mark/copy banner
│   ├── poster/                       ← designer-handoff brand summary (letter portrait)
│   │   └── facet-poster-{dark,light}.webp         ← 1224×1584 wordmark · colors · type · locked phrases
│   ├── swatch/                       ← designer swatch reference (letter landscape, light only)
│   │   └── facet-swatch.webp                      ← 1584×1224 lockups · color swatches · type specimens
│   ├── reference/                    ← internal team reference
│   │   ├── facet-brand-refcard.webp               ← variable height
│   │   └── facet-lockups-{dark,light}.webp        ← 1200×630 lockup specimens
│   └── composite/                    ← per-category reference contact sheets (12 variants)
│       └── facet-composite-{banners,concepts,social,email,carousel,story,principle,manifesto,method,readme,promo,reference}.webp
│
│   Each export folder also has a `thumbs/` subdirectory with 800px-wide
│   thumbnail variants (q80) for use in indexes, README hero images,
│   and small-screen contexts.
└── icons/
    ├── svg/
    │   ├── facet-gem.svg                 ← gem mark, dark bg (default)
    │   ├── facet-gem-active.svg          ← gem mark, dark bg (active/bright)
    │   ├── facet-gem-on-light.svg        ← gem mark, light bg (darker blues)
    │   ├── facet-lockup-on-dark.svg      ← gem + Facet wordmark, dark bg
    │   ├── facet-lockup-on-light.svg     ← gem + Facet wordmark, light bg
    │   └── facet-lockup-sheet.svg        ← lockup variants reference sheet
    └── png/
        ├── facet-gem.png                 ← gem mark, dark bg, high-res raster
        ├── facet-gem-on-light.png        ← gem mark, light bg, high-res raster
        └── facet-lockup-sheet.png        ← lockup reference, raster
```

### Gem Mark Color Variants

The gem uses different blue values depending on the background:

**On dark backgrounds** (default): Crown `#5ba4d9`, pavilion left `#1e5a82`,
pavilion right `#3d88b8`. Active: crown `#6cb8e8`, right `#4a94c8`.

**On light backgrounds**: Crown `#2d6a96`, pavilion left `#1e5a82`,
pavilion right `#2d6a96`. Darker values maintain contrast against white.

In the React component (`FacetGemMark`), the `active` prop toggles
between states. The theme context should determine the base palette.

---

## Usage Rules

1. **Gem mark is the primary icon.** Use it for sidebar, favicon, app
   icons, og:image, and any context below 48px wide.
2. **Two-tone blue is non-negotiable.** The light/dark face split is
   the core visual identity. Don't flatten to a single blue.
3. **Light theme is the default.** The app ships light-first for the
   broadest audience. Dark theme available for preference. Marketing
   and landing pages may use dark for visual impact.
4. **Instrument Serif is wordmark-only.** Don't use it for body text,
   UI labels, or headings in the app. It's for the logo lockup.
6. **Outfit is for hero/marketing contexts.** Landing page headings,
   GitHub banner subtitle, promotional text. Not for body text.
7. **DM Sans is the workhorse.** All app UI text is DM Sans.

---

## Rendering

Brand sheets are HTML source files in `_source/html/`. PNG exports in
`exports/` are generated via `just brand` (or category recipes) using
Playwright headless screenshot. Each sheet contains an in-page
`<script>` that responds to URL hashes — when a hash like
`#system-dark` is present, that variant is isolated and the rest
hidden, so a viewport-sized screenshot captures only the targeted
variant.

| Recipe | What it does |
|---|---|
| `just brand` | Render every category (concepts + banners + social + email + carousel + manifesto + reference) |
| `just brand-concepts` | Render the 14 concept variants (7 concepts × dark+light, 1200×630) |
| `just brand-manifesto` | Render the manifesto anti-card (1080×1350 portrait, dark+light) |
| `just brand-method` | Render the methodology one-pager (1600×900 widescreen, dark+light) |
| `just brand-readme` | Render the GitHub README hero banner (1280×640 2:1, dark+light) |
| `just brand-banners` | Render the 6 hero banner variants — bold, atmospheric, editorial × dark/light |
| `just brand-social` | Render OG, Twitter, GitHub, square — mixed sizes per channel |
| `just brand-email` | Render newsletter masthead (1200×400 dark/light) |
| `just brand-carousel` | Render the 5-slide diamond-centric carousel deck (1080×1350 portrait, dark + light) |
| `just brand-story` | Render IG Stories / Snap vertical poster (1080×1920 dark/light) |
| `just brand-principle` | Render the 3 quote cards (1080×1080 — tagline, method, thesis) |
| `just brand-promo` | Render the launch / "Now available" banner (1200×630 dark/light) |
| `just brand-reference` | Render brand-refcard (variable height) + lockup specimens |
| `just brand-concept SHEET THEME` | Render one concept variant — e.g. `just brand-concept system dark` |
| `just brand-banner VARIANT` | Render one banner variant — e.g. `just brand-banner bold-dark` |
| `just brand-review` | Open all sheets in default browser for visual review |
| `just brand-clean` | Delete everything in `exports/` (HTML sources untouched) |
| `just brand-webp` | Convert PNGs → WebP (full + thumb), PNGs removed |
| `just brand-webp-clean` | Remove WebP files (run `just brand` to regenerate) |
| `just brand-composites` | Render 12 per-category composite reference sheets to `exports/composite/` |

### Output format

**WebP is the canonical export format.** Each render produces:

- `exports/{cat}/foo.webp` — full (max 1600px wide, q90, ~10-15% of source PNG size)
- `exports/{cat}/thumbs/foo.webp` — thumbnail (max 800px wide, q80)

The render pipeline produces a transient PNG which is then converted to
WebP and removed. After `just brand`, the exports folder is WebP-only.
This matches the [atlascrew](../../atlascrew.dev) pattern.

In 2026, all major email clients (Gmail, Outlook web/desktop, Apple
Mail), social platforms (Discord, Slack, LinkedIn, X, IG), and design
tools (Figma, Sketch) accept WebP. The WebP-only library covers nearly
every channel.

### Producing a one-off PNG

If a downstream pipeline genuinely needs PNG (rare in 2026 — typically
some print pre-press workflows or legacy tools), use a single-render
recipe and don't follow with `brand-webp`:

```bash
just brand-banner bold-dark      # → exports/banners/facet-bold-dark.png
just brand-concept system dark   # → exports/concepts/facet-system-dark.png
```

These produce PNG only and skip the WebP conversion.

### Adding a new sheet

1. Create `_source/html/{name}.html` following the existing pattern (per-variant
   ID-scoped CSS, render-mode `<script>` block at the bottom).
2. If it's a concept sheet (1200×630, dark+light), add `{name}` to the
   `sheets="..."` list in the `brand-concepts` recipe — that's it.
3. Otherwise add a category-specific recipe in `justfile`.
