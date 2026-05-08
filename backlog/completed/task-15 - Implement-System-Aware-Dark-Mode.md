---
id: TASK-15
title: Implement System-Aware Dark Mode
status: Done
assignee: []
created_date: '2026-03-01 04:08'
updated_date: '2026-03-06 19:44'
labels: []
milestone: m-1
dependencies: []
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a dark theme to the Facet application shell (excluding the white PDF preview) to reduce eye strain.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Application supports prefers-color-scheme CSS media query.
- [x] #2 Manual toggle in the settings menu to force light/dark/system.
- [x] #3 All UI components (cards, inputs, bars) have high-contrast dark variants.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Audit 'index.css' and extract hardcoded colors into CSS variables in ':root'.
2. Define a '.dark' selector block with overridden color variables.
3. Add a 'theme' field to 'UiState' (light | dark | system).
4. Implement a 'ThemeToggle' component in the 'App.tsx' header.
5. Use a 'useEffect' in 'App.tsx' to apply the '.dark' class to the 'document.documentElement' based on state and 'matchMedia'.
6. Ensure the 'PdfPreview' container remains on a light background for realistic resume visualization.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented system-aware dark mode for the application shell.

Key changes:
- Defined comprehensive dark theme color variables in `src/index.css` under the `:root[data-theme="dark"]` selector, ensuring all UI components (cards, inputs, bars) adapt correctly.
- Enhanced `src/store/uiStore.ts` to manage the `appearance` state ('light' | 'dark' | 'system').
- Implemented a theme application effect in `src/App.tsx` that respects the system preference via `prefers-color-scheme` media query or applies a manual override.
- Added a `ThemeToggle` button in the `App.tsx` header with corresponding icons (Sun, Moon, Monitor) and accessible labels.
- Ensured the `PdfPreview` and `LivePreview` paper backgrounds remain white (`--bg-preview: #ffffff`) to provide a realistic visualization of the final resume.
- Updated component styles (e.g., `toast`, `HelpHint`, `Tour`) to maintain high contrast and usability in dark mode.
- All tests passing.
<!-- SECTION:FINAL_SUMMARY:END -->
