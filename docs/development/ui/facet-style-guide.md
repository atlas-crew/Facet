# Facet — Style Guide

## Design Philosophy

**Dark, not dim. Professional, not corporate. Ultra-modern, not trendy.**

Facet is a precision tool for senior engineers. The aesthetic draws from high-end design tools (Linear, Raycast, Figma) — not a SaaS marketing page and not a terminal. Every pixel communicates competence and intentionality. The interface disappears to let the content be the focus.

### Guiding Principles

1. **Quiet confidence** — No gradients, no glowing borders, no pulsing animations. The UI earns trust through restraint, not flash.
2. **Content-first** — Resume text is the product. The UI is scaffolding. Component cards should feel like reading a document, not browsing a dashboard.
3. **Tool, not toy** — This is used during high-stakes job searches. No playful illustrations, no emoji, no casual copy. Precise, efficient, respectful of the user's time.
4. **Density without clutter** — Senior engineers want information density. Don't over-space things. But use whitespace structurally — to separate concerns, not to fill a page.

---

## Architecture & Layered Conventions

Facet has a mature CSS token system but does not extract React components into a Facet UI package (no shadcn/ui, no Material, no internal component library). Visual consistency across workspaces is held by token-level discipline, Tailwind utility classes doing standardization work, and convention-by-imitation — agents reference existing implementations (typically Match or Identity workspaces) when building new surfaces.

This is intentional, not accidental. Building a Facet UI package would require extracting working components, generalizing their APIs, and refactoring N workspaces to consume them — high cost, deferred benefit. This style guide is the lighter-weight intervention: documented conventions that prevent reinvention.

### Three layers of consistency

Different parts of the system have different commitment levels:

**Layer 1 — Tokens (strong, enforced):** CSS variables defined in `src/index.css`. Color palette, typography scale, spacing units, semantic status, content-typing. Never duplicate as hardcoded values. Always read from the variables. New colors, sizes, or spacing values do not get hardcoded; they get added to the token system if they're a real new design token, or they map to existing tokens if they're a variation of one.

**Layer 2 — Primitives (moderate, by convention):** Card chrome, button hierarchy, vector badges, eyebrow labels, KPI cards, status badges, content-typed left borders, progressive disclosure patterns. Same shape across workspaces. Documented in the Component Patterns and Workspace Patterns sections below.

**Layer 3 — Composition (weak, by workspace):** How primitives compose into "a Match report" vs "a Prep deck" vs "a Letters draft" — each workspace evolved its own organizing principle. Don't try to standardize layer 3. Different workspaces do genuinely different jobs.

### When to extract a React primitive

Defer extraction to `src/components/ui/` until **all four** are true:

1. The pattern appears in 3+ workspaces with effectively-identical implementation
2. The pattern's API surface (props, slots, variants) is genuinely understood from real usage, not invented from imagination
3. A bug or design change has required fixing the same thing in N places (or a contributor asks "how do I do X consistently")
4. The cost of extraction (implementation, refactoring callers, API migration) is justifiable against the cost of continuing to copy

If any of those is false, prefer inline implementation with reference to this guide.

> **Status (2026-06-16): the gate has fired for the primitive layer.** An audit
> found the predicted failure of convention-only consistency at ~8 workspaces —
> 49 forked button classes, 40 badge classes, 15 eyebrow classes,
> `.label-tracked` redefined in `identityMap.css`. Condition #3 is met (a button
> restyle touches ~49 class definitions across 12+ files). `Button`,
> `SectionLabel`, and `StatusBadge` are being extracted into
> `src/components/ui/`. This does not reverse the deferral policy — it is the
> gate working as designed. See
> [adr-0011](../../architecture/decisions/adr-0011-extract-ui-primitive-layer.md)
> and the
> [rollout plan](../../development/plans/ui-primitive-consolidation-rollout-plan.md)
> (milestone M12). Tokens (L1) and per-workspace composition (L3) remain
> unchanged. Authoring conventions for the new layer live in
> [`src/components/ui/README.md`](../../../src/components/ui/README.md).

---

## Color System

### Base Palette (Dark Mode)

```css
:root {
  /* Backgrounds */
  --bg-primary: #0a0c10;          /* Main background — deep blue-black */
  --bg-surface: #12151c;           /* Cards, panels, top/status bars */
  --bg-surface-hover: #171b24;    /* Card hover state */
  --bg-inset: #0e1117;            /* Secondary panels, preview shell */
  --bg-preview: #ffffff;           /* Resume paper — pure white */

  /* Borders */
  --border-subtle: #252a36;       /* Default borders — quiet, structural */
  --border-default: #303745;      /* Active/hover borders */
  --border-strong: #4e5d71;       /* Emphasis borders */

  /* Text */
  --text-primary: #e8ecf2;        /* Headings, primary content — bright */
  --text-secondary: #c0c8d4;      /* Body text, descriptions */
  --text-tertiary: #6b7a8d;       /* Labels, metadata, placeholders */
  --text-inverse: #0a0c10;        /* Text on light backgrounds (vector pills) */

  /* Accents — Muted, professional */
  --accent-primary: #5ba4d9;      /* Primary actions, focus rings — sky blue */
  --accent-primary-subtle: color-mix(in srgb, var(--accent-primary) 28%, transparent);
  --accent-primary-hover: #6cb8e8;

  /* Vector colors — Assigned per vector, distinguishable */
  /* Fallback palette: #2563EB, #0D9488, #7C3AED, #EA580C, #4F46E5, #0891B2 */

  /* Priority badges — Text color only, no backgrounds */
  --priority-must: #e8ecf2;       /* Bright — strong, definite */
  --priority-strong: #c0c8d4;     /* Secondary weight */
  --priority-optional: #6b7a8d;   /* Tertiary weight */

  /* Status */
  --success: #3fbf8a;
  --warning: #d8a34d;
  --error: #f07178;

  /* Shadows — Heavier than light mode to register on dark bg */
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.32);
  --shadow-md: 0 8px 24px rgba(0, 0, 0, 0.35);
  --shadow-lg: 0 14px 40px rgba(0, 0, 0, 0.5);
}
```

All colors are defined as CSS custom properties. A future light mode is a variable swap, not a rewrite.

### Content-Typing Tokens (Identity Map architecture)

Color tokens that identify identity content types across the application. These are **semantic** — the colors carry meaning. Use them rather than direct color values when expressing content type, and never repurpose them for unrelated content.

```css
:root {
  --layer-thesis: var(--accent-primary);    /* Thesis content (sky blue) */
  --layer-self: var(--success);             /* Self-model content (green) */
  --layer-profiles: var(--accent-violet);   /* Profiles (violet) */
  --layer-roles: var(--accent-orange);      /* Roles and projects (orange) */
  --layer-skills: #d946ef;                  /* Skills (magenta) */
  --layer-prefs: var(--accent-cyan);        /* Preferences (cyan) */
}
```

**The semantic meaning is consistent across workspaces.** When a card or section uses `--layer-roles`, the user can rely on it indicating roles/projects content regardless of which workspace they're in. Don't use `--layer-roles` to mean "the third item" or for decorative variety.

### Semantic Color Usage Rules

**Status tokens** (`--success`, `--warning`, `--error`) communicate state, not category:

- `--success` — operations that completed successfully, content that's complete/healthy/ready
- `--warning` — content that needs attention but isn't broken, drift detected, soft validation failures
- `--error` — failures, hard validation errors, destructive actions, contract violations

Don't use `--success` green as a decorative accent for "good things" — it carries a specific operational-state meaning.

**Priority tokens** (`--priority-must`, `--priority-strong`, `--priority-optional`) communicate filter-condition severity:

- `--priority-must` — bright, definite. Hard requirements, must-haves, deal-breakers.
- `--priority-strong` — secondary weight. Strong preferences, important but not required.
- `--priority-optional` — tertiary weight. Soft preferences, nice-to-haves.

Use these specifically for filter and constraint UI, not for general typographic hierarchy.

**Accent tokens** beyond `--accent-primary`:

- `--accent-violet`, `--accent-cyan`, `--accent-orange` — secondary accents, primarily used as the underlying values for content-typing layer tokens. Reach for the `--layer-*` token when expressing content type; reach for the underlying `--accent-*` token only when you need an accent that doesn't carry layer semantics.

---

## Typography

### Font Stack

**Primary (UI):** `"DM Sans"` — Clean geometric sans-serif, excellent at small sizes. Falls back to `"Inter"` then system sans-serif.

**Monospace (tags, metadata, status):** `"DM Mono"` — Pairs with DM Sans. Fallback to `"JetBrains Mono"` then system monospace.

**Brand:** `"Outfit"` — Used only for the Facet wordmark. Light weight (300), large size.

**Preview panel (resume rendering):** Configurable per theme preset. Supports: Inter, DM Sans, Source Serif 4, PT Serif, IBM Plex Sans, IBM Plex Serif, Newsreader, DM Mono. All loaded from `/public/fonts/` as `.ttf` files.

```css
:root {
  --font-sans: 'DM Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'DM Mono', 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
  --font-brand: 'Outfit', 'DM Sans', 'Inter', sans-serif;
}
```

Fonts loaded via Google Fonts in `index.html` (Outfit, DM Mono, DM Sans).

### Type Scale

| Use | Size | Weight | Font | Color |
|-----|------|--------|------|-------|
| Page title | 15px | 500 | Sans | --text-primary |
| Section header | 11px | 600 | Mono | --text-tertiary |
| Component name | 14px | 500 | Sans | --text-primary |
| Component body | 13px | 400 | Sans | --text-secondary |
| Vector badge | 11px | 500 | Mono | vector color |
| Priority badge | 10px | 600 | Mono | priority color |
| Button label | 13px | 500 | Sans | varies |
| Status bar | 12px | 400 | Mono | --text-tertiary |
| Metadata/label | 11px | 400 | Sans | --text-tertiary |
| Brand wordmark | 32px | 300 | Brand | --text-primary |
| Brand tagline | 11px | 400 | Mono | --text-tertiary |

### Section Headers
All-caps, letterspaced, monospace. Small. They're wayfinding labels, not headlines.

```css
.library-section-toggle {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}
```

---

## Spacing System

Use a **4px base grid**. All spacing values are multiples of 4.

| Token | Value | Use |
|-------|-------|-----|
| --space-1 | 4px | Tight gaps (badge padding, inline spacing) |
| --space-2 | 8px | Component internal padding, gap between badges |
| --space-3 | 12px | Card padding (compact), gap between small elements |
| --space-4 | 16px | Card padding (default), section gap |
| --space-6 | 24px | Panel padding, major section separation |
| --space-8 | 32px | Page-level padding |

---

## Component Patterns

### Cards (Component Cards)
```css
.component-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 12px 16px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
}

.component-card:hover {
  border-color: var(--border-default);
  box-shadow: var(--shadow-sm);
}

.component-card:focus-within {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 1px var(--accent-primary-subtle);
}

.component-card.dimmed {
  opacity: 0.5;
  border-style: dashed;
}
```

Cards should feel structural. No heavy shadows, no rounded-to-the-moon corners. The border does the work. Excluded cards use dashed borders as a shape-based differentiator alongside reduced opacity.

### Sections (Collapsible Accordion)
Library sections use a CSS grid animation for smooth expand/collapse:

```css
.library-section-collapse {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 250ms ease;
}

.library-section-collapse.expanded {
  grid-template-rows: 1fr;
}
```

The panel is always in the DOM (preserving textarea state) — only visually collapsed.

### Vector Badges
Small, pill-shaped, monospace. The vector color is the text + a very subtle background tint.

```css
.vector-badge {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
  color: var(--vector-color);
  background: color-mix(in srgb, var(--vector-color) 8%, transparent);
}
```

### Buttons

**Primary** (Download PDF — the most important action):
```css
.btn-primary {
  background: var(--text-primary);
  color: var(--text-inverse);
  border: none;
  border-radius: 6px;
  padding: 8px 20px;
  font-size: 13px;
  font-weight: 500;
}
```

**Secondary** (Import, Export, Analyze JD):
```css
.btn-secondary {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-default);
  border-radius: 6px;
  padding: 8px 16px;
}
```

**Ghost** (inline actions, icon-only buttons):
```css
.btn-ghost {
  background: transparent;
  color: var(--text-tertiary);
  border: none;
  padding: 4px 8px;
}
```

---

## Workspace Patterns

The patterns below appear across multiple workspaces (Match, Identity, Build, Letters, Pipeline, Prep). They are not extracted as React components yet (per the deferral decision in *Architecture & Layered Conventions*), but they have stabilized as conventions.

### Workspace Shell

Per the workspace-shell IA redesign (TASK-123 series, shipped). Every tracked workspace has the same skeleton:

**Header:**
- Eyebrow label (mono small caps) naming the workspace's navigation class — `FOUNDATION`, `ANALYZE`, `APPLY`, `INTERVIEW` (per decision-10)
- H1 title naming the workspace
- One-sentence purpose description below the title

**Primary action:**
- One dominant primary action button per workspace, top-right of the header
- Uses `.btn-primary` (token `--accent-primary` background, dark text)
- Examples: "Generate Match Report" (Match), "Run Search" (Research), "Generate with AI" (Letters), "Add Entry" (Pipeline)

**Secondary actions:**
- Visually demoted from the primary, using `.btn-secondary` or `.btn-ghost`
- Examples: Add Card, Import, Export, Delete Set

**Status indicator (optional):**
- Top-right next to the primary action when relevant
- "Ready" / "AI working" / model state indicator using `--success` / `--warning` / `--text-tertiary`

**Empty-state hierarchy:**
- Workspaces with no content show a centered empty state with primary CTA
- Empty states should reflect what the user can do, not what's missing

### Content-typed Left Borders

A repeated organizing primitive across workspaces. A vertical accent strip on the left edge of a card or section signals content-type identity at a glance.

```css
.thesis-card { border-left: 1.5px solid var(--layer-thesis); }
.self-model-card { border-left: 1.5px solid var(--layer-self); }
.profiles-card { border-left: 1.5px solid var(--layer-profiles); }
.roles-card { border-left: 1.5px solid var(--layer-roles); }
.skills-card { border-left: 1.5px solid var(--layer-skills); }
.prefs-card { border-left: 1.5px solid var(--layer-prefs); }
```

The colors carry semantic meaning across the entire app. Don't repurpose them for unrelated content.

**Don't use for:**
- Pure decoration — use `--border-subtle` instead
- Hierarchy alone — headers don't need accent borders
- Status indication — use status badges with semantic tokens instead

**Implementation:**
- Card chrome remains thin/subtle so the border carries the visual weight
- Border width: 1.5px (consistent across the app)

### KPI Cards

The headline-metric card pattern that appears in Match, Identity, and other report-style surfaces.

**Structure:**
- Eyebrow (mono caps via `--font-mono`): metric category — `OVERALL FIT`, `MATCH SCORE`
- Headline value: large numeric or short string — `94%`, `strong`
- Subtitle: 13-14px, contextualizes the metric — `apply recommendation`
- Optional content-typed left border using a layer token

**Composition:**
- Group in trios for headline metrics (3 cards across)
- Don't stack 6+ KPI cards in close proximity — that's metric overload

### Status Badges

For inline state indicators (active/inactive, ready/working, complete/pending).

**Structure:**
- Mono small caps text (`--font-mono`)
- Tinted background using semantic token + transparency: `background: color-mix(in srgb, var(--success) 14%, transparent)`
- Text color matching the semantic token
- Subtle border in the same hue
- Border radius: 3-4px

**Token mapping:**
- Success states → `--success`
- Warning states → `--warning`
- Error states → `--error`
- Info/neutral → `--accent-primary` or `--text-tertiary`
- Priority levels → `--priority-must` / `--priority-strong` / `--priority-optional`

### Progressive Disclosure

Per TASK-207 (Match polish), TASK-212 (Pipeline progressive disclosure).

**For dense content:**
- Default state shows summary or headline
- Expandable sections reveal full detail
- Expand affordance: rotation arrow or chevron, right-aligned
- Respect deep linking when relevant — opening a report should auto-expand to the relevant section

**Composition:**
- Long pages should not be flat lists of seven+ collapsed sections. Group related sections under a parent header where possible.

### Section Eyebrows (`.label-tracked`)

Mono small caps labels above section headers, identifying the section's category or role.

```css
.label-tracked {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}
```

**Examples:**
- `FOUNDATION` / `ANALYZE` / `APPLY` / `INTERVIEW` (sidebar navigation per decision-10)
- `OPENER GUIDANCE` / `BEHAVIORAL GUIDANCE` (Prep workspace section labels)
- `AI DRAFT` / `AI WORKING` (status indicators)

### Composition Layer (do not standardize)

Each workspace organizes its primitives differently because they do different jobs:

- **Match report:** color-typed cards at the metric level; collapsible sections with content-typed borders; KPI trio at the top.
- **Identity Model:** content-typed full sections at the document level; status badges per section signaling content quality.
- **Interview Prep:** form-heavy layout with nested sections; tab-mode shell (Edit / Homework / Live Cheatsheet); rich content cards.
- **Letters:** two-column layout with History sidebar; AI-draft form layout; empty-state CTA.

These differences are intentional. Match is read-only output; Identity is content-input; Prep is editing-and-rehearsal; Letters is generation-and-history. Forcing them into the same composition would lose information.

---

## Layout

The structure below describes the **Build workspace** specifically — the original two-panel library + preview layout that predates the multi-workspace product. Other workspaces (Match, Research, Pipeline, Prep, Letters, Identity) follow the **Workspace Shell** pattern documented above and have their own internal layouts appropriate to their job.

### Build Workspace — Overall Structure
```
Full viewport height. No scrolling on the page level — panels scroll independently.

┌───────────────────────────────────────────────────────────────────────┐
│  Top bar: Brand left | Variant controls center | Actions right        │  auto
├───────────────────────────────────────────────────────────────────────┤
│  Theme editor panel (collapsible, toggled via gear icon)              │  auto
├───────────────────────────────────────────────────────────────────────┤
│  Vector bar: [All] [V1] [V2] [V3]  ·  [+ New Vector] [Reset Auto]   │  sticky
├──────────────────────────────┬────────────────────────────────────────┤
│                              │                                        │
│  Component Library (~45%)    │  PDF Preview (~55%)                     │
│  overflow-y: auto            │  overflow-y: auto                      │
│  padding: 24px               │  padding: 16px                         │
│  background: transparent     │  background: var(--bg-inset)           │
│                              │                                        │
├──────────────────────────────┴────────────────────────────────────────┤
│  Status bar: pages · bullets · skill groups · warnings                │  32px
└───────────────────────────────────────────────────────────────────────┘
```

### Top Bar Zones
- **Left:** Brand lockup (Facet mark + wordmark + tagline)
- **Center:** Preset controls (preset selector, save/delete)
- **Right:** Theme toggle (gear icon), Import, Export, Analyze JD, Copy (icon-only), Download PDF

### Preview Panel
The preview embeds a Typst-rendered PDF in an iframe. The inset background makes the white paper pop.

### Resizable Split
The divider between panels is draggable (30%–70% range). A centered grab indicator line appears on hover. The split preference is persisted in localStorage.

---

## Iconography

**Lucide** icons via `lucide-react`.

- Size: 16px for buttons, 14px for badges and inline
- Stroke width: 1.5 (Lucide default)
- Color: inherit from text color

Key icons: `GripVertical` (drag), `Eye`/`EyeOff` (toggle), `Download`, `Upload`, `FileJson`, `Copy`, `FileDown`, `Plus`, `Target` (vector), `Settings2` (theme), `ChevronRight` (section toggle), `AlertTriangle` (warning).

---

## Motion & Transitions

### Philosophy
Motion is **functional, not decorative**. Things move to communicate state changes, not to entertain. Keep durations short.

### Timing
```css
:root {
  --duration-fast: 100ms;      /* Hover states, toggles */
  --duration-normal: 150ms;    /* Card selection, border transitions */
  --duration-slow: 250ms;      /* Section collapse, modal transitions */
  --easing: cubic-bezier(0.4, 0, 0.2, 1);
}
```

### What animates
- Card hover → border color, shadow (fast)
- Card focus-within → accent border (normal)
- Section expand/collapse → grid-template-rows (slow)
- Drag reorder → smooth position swap (normal)
- Toast notifications → auto-dismiss after 2.5s
- Modal backdrop → blur + fade
- Splitter hover → grab indicator opacity (normal)
- Theme gallery cards → subtle scale on hover (normal)

### What doesn't animate
- Text content changes (instant swap)
- Scroll (native)
- Page load (no staggered reveals — tool should feel instant)

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `1`–`9` | Select vector by position |
| `0` | Select "All" vectors |
| `⌘I` | Open Import dialog |
| `⌘E` | Open Export dialog |
| `⌘P` | Download PDF |
| `Escape` | Close active modal/panel, or blur focused input |

Shortcuts are surfaced via `title` attributes on buttons (native browser tooltips).

---

## Responsive Behavior

### Desktop (>1024px)
Full two-panel layout with draggable splitter.

### Tablet (768–1024px)
Panels stack vertically. Splitter becomes horizontal.

### Mobile (<768px)
Single column. Top bar stacks. Vector bar scrolls horizontally. Reduced padding.

---

## Empty States

When no vectors are defined, a centered card shows:
- A CSS wireframe mockup hinting at the two-panel layout
- Explanation of what vectors are
- Three action buttons: Import Config, Load Sample Data, Start from Scratch

No illustrations. No emoji. Just structure and clear next steps.

---

## Do's and Don'ts

### Do
- Use consistent 4px grid spacing
- Let whitespace do the structural work
- Keep text small and dense where appropriate (power-user tool)
- Use monospace for metadata, labels, and tags
- Make the preview panel feel like real paper
- Ensure every interactive element has a visible hover/focus state
- Keep border-radius small (4–8px max for cards, 4–6px for pills)
- Use dashed borders + opacity for excluded/disabled states (not opacity alone)
- Style scrollbars to match the dark theme

### Don't
- Don't use gradients anywhere
- Don't use shadows heavier than `--shadow-lg`
- Don't use more than 3 font families (sans, mono, brand)
- Don't use color as the only differentiator (pair with text/shape)
- Don't animate text content changes
- Don't use rounded corners >8px on any element
- Don't add decorative elements (illustrations, patterns, blobs)
- Don't use placeholder text that's cute or clever
- Don't default to purple

---

## Reference Aesthetic

The closest existing products to the target feel:

- **Linear** — Minimal dark UI, monospace labels, information-dense, professional
- **Raycast** — Clean, fast, tool-like, respects the user's expertise
- **Figma** — Dark chrome with white canvas, tool-centric
- **Warp Terminal** — Modern dark aesthetic with thoughtful type hierarchy

Study these for spatial relationships and information hierarchy, not to copy their layouts.
