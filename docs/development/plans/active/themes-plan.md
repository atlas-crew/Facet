# Vector Resume v0.2 — Theme System Spec

## Overview

A theme is a set of design tokens (fonts, sizes, spacing, colors, section styles) applied to the resume output. Ship 3-4 presets. Users can pick a preset and override individual tokens without touching code.

---

## Design Tokens

```typescript
interface ResumeTheme {
  id: string;
  name: string;                    // "Ferguson v1.2"

  // Typography
  fontBody: string;                // "Calibri"
  fontHeading: string;             // "Calibri" (can differ from body)
  sizeBody: number;                // 9 (points)
  sizeName: number;                // 14
  sizeSectionHeader: number;       // 10.5
  sizeRoleTitle: number;           // 9
  sizeCompanyName: number;         // 10
  sizeSmall: number;               // 8.5
  sizeContact: number;             // 8.5

  // Spacing (points)
  lineHeight: number;              // 1.15 (multiplier)
  bulletGap: number;               // 2.5 (space after each bullet)
  sectionGapBefore: number;        // 10
  sectionGapAfter: number;         // 3
  roleGap: number;                 // 7
  roleLineGapAfter: number;        // 3
  paragraphGap: number;            // 2
  contactGapAfter: number;         // 6
  competencyGap: number;           // 1
  projectGap: number;              // 3

  // Margins (inches)
  marginTop: number;               // 0.45
  marginBottom: number;            // 0.45
  marginLeft: number;              // 0.75
  marginRight: number;             // 0.75

  // Colors (hex, no #)
  colorBody: string;               // "333333"
  colorHeading: string;            // "1a1a1a"
  colorSection: string;            // "2b5797"
  colorDim: string;                // "666666" (dates, subtitles)
  colorRule: string;               // "2b5797" (section header underline)
  roleTitleColor: string;          // "1a1a1a"
  datesColor: string;              // "666666"
  subtitleColor: string;           // "666666"
  competencyLabelColor: string;    // "1a1a1a"
  projectUrlColor: string;         // "2b5797"

  // Section Header Style
  sectionHeaderStyle: 'caps-rule' | 'bold-rule' | 'bold-only' | 'underline';
  sectionHeaderLetterSpacing: number;  // 3 (points, 0 = none)
  sectionRuleWeight: number;       // 0.5 (points, thickness of rule line)

  // Layout and formatting
  nameLetterSpacing: number;       // 4
  nameBold: boolean;               // true
  nameAlignment: 'left' | 'center' | 'right';
  contactAlignment: 'left' | 'center' | 'right';
  roleTitleItalic: boolean;        // true
  datesAlignment: 'right-tab' | 'inline';
  subtitleItalic: boolean;         // true
  companyBold: boolean;            // true

  // Bullet Style
  bulletChar: '•' | '–' | '▸' | 'none';
  bulletIndent: number;            // 18 (points, left indent for bullets)
  bulletHanging: number;           // 10

  // Content styles
  competencyLabelBold: boolean;
  projectNameBold: boolean;
  projectUrlSize: number;
  educationSchoolBold: boolean;
}
```

---

## Presets

Note: The first preset below is the canonical, full token object. Additional presets can omit unchanged optional fields in examples, but runtime presets should provide all tokens.

### 1. Ferguson v1.2 (default)
```json
{
  "id": "ferguson-v12",
  "name": "Ferguson v1.2",
  "fontBody": "Calibri",
  "fontHeading": "Calibri",
  "sizeBody": 9,
  "sizeName": 14,
  "sizeSectionHeader": 10.5,
  "sizeRoleTitle": 9,
  "sizeCompanyName": 10,
  "sizeSmall": 8.5,
  "sizeContact": 8.5,
  "lineHeight": 1.15,
  "bulletGap": 2.5,
  "sectionGapBefore": 10,
  "sectionGapAfter": 3,
  "roleGap": 7,
  "roleLineGapAfter": 3,
  "paragraphGap": 2,
  "contactGapAfter": 6,
  "competencyGap": 1,
  "projectGap": 3,
  "marginTop": 0.45,
  "marginBottom": 0.45,
  "marginLeft": 0.75,
  "marginRight": 0.75,
  "colorBody": "333333",
  "colorHeading": "1a1a1a",
  "colorSection": "2b5797",
  "colorDim": "666666",
  "colorRule": "2b5797",
  "roleTitleColor": "1a1a1a",
  "datesColor": "666666",
  "subtitleColor": "666666",
  "competencyLabelColor": "1a1a1a",
  "projectUrlColor": "2b5797",
  "sectionHeaderStyle": "caps-rule",
  "sectionHeaderLetterSpacing": 3,
  "sectionRuleWeight": 0.5,
  "nameLetterSpacing": 4,
  "nameBold": true,
  "nameAlignment": "center",
  "contactAlignment": "center",
  "roleTitleItalic": true,
  "datesAlignment": "right-tab",
  "subtitleItalic": true,
  "companyBold": true,
  "bulletChar": "•",
  "bulletIndent": 18,
  "bulletHanging": 10,
  "competencyLabelBold": true,
  "projectNameBold": true,
  "projectUrlSize": 8.5,
  "educationSchoolBold": true
}
```

### 2. Clean Modern
Slightly more breathing room. Aptos font. Lighter feel.
```json
{
  "id": "clean-modern",
  "name": "Clean Modern",
  "fontBody": "Aptos",
  "fontHeading": "Aptos",
  "sizeBody": 10,
  "sizeName": 16,
  "sizeSectionHeader": 11,
  "sizeRoleTitle": 10.5,
  "sizeSmall": 9,
  "lineHeight": 1.2,
  "bulletGap": 3,
  "sectionGap": 12,
  "roleGap": 8,
  "paragraphGap": 4,
  "marginTop": 0.5,
  "marginBottom": 0.5,
  "marginLeft": 0.85,
  "marginRight": 0.85,
  "colorBody": "2d2d2d",
  "colorHeading": "111111",
  "colorSection": "1a1a1a",
  "colorDim": "777777",
  "colorRule": "cccccc",
  "sectionHeaderStyle": "bold-rule",
  "sectionHeaderLetterSpacing": 1,
  "sectionRuleWeight": 0.25,
  "bulletChar": "–",
  "bulletIndent": 16
}
```

### 3. Classic Serif
Traditional look. Times-family font. No color.
```json
{
  "id": "classic-serif",
  "name": "Classic Serif",
  "fontBody": "Times New Roman",
  "fontHeading": "Times New Roman",
  "sizeBody": 10.5,
  "sizeName": 14,
  "sizeSectionHeader": 11,
  "sizeRoleTitle": 10.5,
  "sizeSmall": 9.5,
  "lineHeight": 1.15,
  "bulletGap": 2,
  "sectionGap": 10,
  "roleGap": 6,
  "paragraphGap": 3,
  "marginTop": 0.75,
  "marginBottom": 0.75,
  "marginLeft": 1.0,
  "marginRight": 1.0,
  "colorBody": "000000",
  "colorHeading": "000000",
  "colorSection": "000000",
  "colorDim": "444444",
  "colorRule": "000000",
  "sectionHeaderStyle": "caps-rule",
  "sectionHeaderLetterSpacing": 2,
  "sectionRuleWeight": 0.75,
  "bulletChar": "•",
  "bulletIndent": 18
}
```

### 4. Minimal
Maximum density. Small font. Tight spacing. For when you need to fit a lot.
```json
{
  "id": "minimal",
  "name": "Minimal",
  "fontBody": "Arial",
  "fontHeading": "Arial",
  "sizeBody": 8.5,
  "sizeName": 12,
  "sizeSectionHeader": 9.5,
  "sizeRoleTitle": 9,
  "sizeSmall": 8,
  "lineHeight": 1.1,
  "bulletGap": 1.5,
  "sectionGap": 8,
  "roleGap": 5,
  "paragraphGap": 1.5,
  "marginTop": 0.4,
  "marginBottom": 0.4,
  "marginLeft": 0.6,
  "marginRight": 0.6,
  "colorBody": "333333",
  "colorHeading": "111111",
  "colorSection": "555555",
  "colorDim": "888888",
  "colorRule": "aaaaaa",
  "sectionHeaderStyle": "bold-only",
  "sectionHeaderLetterSpacing": 0,
  "sectionRuleWeight": 0,
  "bulletChar": "▸",
  "bulletIndent": 14
}
```

---

## UI

### Theme Picker
- Dropdown or card selector in the toolbar: "Theme: Ferguson v1.2 ▾"
- Clicking shows preset cards with mini-previews (small thumbnail of how the resume looks)
- Selecting a preset applies it immediately to the live preview

### Token Override Panel
- Gear icon next to theme picker opens a collapsible panel
- Groups: Typography, Spacing, Margins, Colors, Section Style, Bullets
- Each token shows: label, current value, input control (number, color picker, dropdown)
- Changing any token marks the theme as "Ferguson v1.2 (modified)"
- "Reset to Preset" button clears overrides

### Controls by Type
- Fonts: dropdown with web-safe + common system fonts (Calibri, Aptos, Arial, Helvetica, Times New Roman, Georgia, Garamond, Palatino)
- Sizes: number input with 0.5pt increments
- Spacing: number input with 0.5pt increments
- Margins: number input with 0.05" increments  
- Colors: hex input with color picker swatch
- Section style: dropdown (caps-rule, bold-rule, bold-only, underline)
- Bullet char: dropdown (•, –, ▸, none)

---

## Integration

### Live Preview
Theme tokens feed directly into the preview renderer. Changing a token updates the preview in real time. No save-then-refresh cycle.

### DOCX Export
The DOCX renderer reads theme tokens to set:
- Font family and sizes on all TextRun objects
- Paragraph spacing on all Paragraph objects
- Page margins on section properties
- Border styles on section headers
- Bullet formatting on list items
- Color values on all styled elements

### Persistence
- Active theme ID + any overrides stored in localStorage
- Included in JSON export/import (under a `theme` key)
- Saved variants (Feature 4) can optionally include theme overrides

### Data Shape in Export
```json
{
  "theme": {
    "preset": "ferguson-v12",
    "overrides": {
      "fontBody": "Aptos",
      "marginLeft": 0.85
    }
  }
}
```

If `overrides` is empty or absent, use preset defaults. Overrides are sparse — only include tokens that differ from the preset.

---

## Constraints

- Fonts limited to system/web-safe fonts that reliably render in Word, Google Docs, and LibreOffice. No custom font loading.
- No column layouts, no multi-column sections, no text boxes. ATS compatibility is non-negotiable.
- No images or graphics. Ever.
- Minimum body font size: 8pt. Maximum: 12pt. Guard rails so users don't create unreadable resumes.
- Minimum margins: 0.4". Maximum: 1.25".

---

## What This Is NOT

- Not a WYSIWYG editor. You pick tokens, not drag elements.
- Not a template builder. Presets are code-defined. Users customize via tokens only.
- Not a CSS editor. No raw style input.
