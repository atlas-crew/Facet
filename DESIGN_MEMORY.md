# DESIGN_MEMORY.md - Design Decisions

## Color Palette
- **Backgrounds:**
  - Main Workspace: `#f1f5f9` (Subtle blue-gray)
  - Resume Paper: `#ffffff`
  - Glass Panels: `rgba(255, 255, 255, 0.7)` (with 12px blur)
- **Borders:**
  - Subtle: `rgba(226, 232, 240, 0.8)`
  - Active: `#0f172a`
- **Text:**
  - Primary: `#0f172a`
  - Secondary: `#64748b`
  - Tertiary: `#94a3b8`

## Typography
- **UI Text:** Inter, system-ui, sans-serif
  - Name/Logo: 13px (Semi-bold, -0.01em tracking)
  - Sidebar Headers: 10px (Uppercase, 0.05em tracking)
  - Control Labels: 12px (Regular/Semi-bold)
- **Resume Preview:** (Content-driven, uses project's existing font system: Charter/Geist Sans)

## Spacing & Density
- **Base Grid:** 4px
- **Standard Gap:** 10px-12px
- **Compact Gap:** 4px-8px
- **Padding:**
  - Sidebar: 10px
  - Top Bar: 0 16px
  - Paper: 40px (on screen)

## Component Patterns
- **Glassmorphic Top Bar:** 44px height, sticky, blurred background.
- **Glassmorphic Sidebar:** 260px width, blurred background, subtle border-right.
- **Deep Layered Shadows:** Used to distinguish "editing" surface from "builder" controls.
- **Refined Buttons:** 3px-4px padding (compact) with subtle white backgrounds and 1px borders.
