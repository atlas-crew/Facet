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

## Layout

### Overall Structure
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
- **Center:** Variant controls (saved variant selector, save/delete)
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
