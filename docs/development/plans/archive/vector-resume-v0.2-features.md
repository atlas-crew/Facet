# Vector Resume v0.2 — Feature Specs

Six features to take the MVP from demo to daily-use tool. These build on the existing React + Vite app with the component library, vector priority system, and live preview already working.

---

## Feature 1: Data Import/Export (JSON)

### Problem
Content currently has to be entered manually through the UI. The user has 20+ bullets, 3 roles, 6 skill groups, and multiple profiles already structured in external tooling. They need to load all of it in one shot.

### Spec

**Import flow:**
1. Click "Import" button in header toolbar
2. Modal opens with a textarea and a "Choose File" button
3. User pastes JSON or selects a `.json` file
4. App validates the schema, shows error summary if invalid (with line numbers)
5. User chooses: "Replace All" (wipe current data) or "Merge" (add new components, skip duplicates by `id`)
6. On confirm, data loads into the store and UI updates immediately

**Export flow:**
1. Click "Export" button in header toolbar
2. Downloads a `.json` file containing the complete resume data (all components, vectors, priorities, variants, ordering)
3. The exported file is a valid import file — round-trip guaranteed

**JSON Schema:**
Use the schema from the existing product spec (`version`, `meta`, `vectors`, `target_lines`, `profiles`, `skill_groups`, `roles` with nested `bullets`, `projects`, `education`). The schema is already defined in the spec — implement TypeScript interfaces matching it exactly.

**Validation rules:**
- All `id` fields must be unique across their type
- Vector references in priority maps must reference defined vectors
- Required fields: `meta.name`, at least one `role` with at least one `bullet`
- Warn (don't block) on: missing vector tags, empty text fields

**Edge cases:**
- Import with vectors that don't exist yet → auto-create them with default colors
- Import with bullet referencing a role that doesn't exist → reject with clear error
- Preserve any manual overrides or reorderings from the UI if doing a merge

### Acceptance Criteria
- [ ] Can paste JSON, validate, and load all content in one action
- [ ] Can upload a `.json` file
- [ ] Export produces a file that re-imports identically
- [ ] Schema validation with human-readable errors
- [ ] Merge mode doesn't destroy existing manual tweaks

---

## Feature 2: Bullet Reordering Per Vector

### Problem
Vector priority controls *inclusion* (must/strong/optional/exclude), but the whole point of multi-vector resumes is that the **same bullets appear in different order** depending on the positioning angle. A security resume should lead with the Synapse bullet; a platform resume should lead with the IDP bullet. The user needs to drag bullets into a specific order *per vector*, and that ordering should persist independently.

### Spec

**Per-vector ordering model:**
Each role maintains a `bulletOrder` map:
```typescript
interface Role {
  // ... existing fields
  bulletOrder: {
    [vectorId: string]: string[];  // ordered array of bullet IDs
    _default: string[];            // fallback ordering
  };
}
```

When a vector is active, bullets display in that vector's order. If no vector-specific order exists, fall back to `_default`. When viewing "All", use `_default`.

**Drag-and-drop behavior:**
- Bullets within each role are draggable (drag handle on left side, already visible in MVP)
- When the user reorders bullets while a vector is active, the new order saves to that vector's ordering only — other vectors are unaffected
- When the user reorders bullets while "All" is active, the new order saves to `_default`
- Visual indicator: small badge or tooltip showing "Custom order for [vector]" when a role has vector-specific ordering that differs from default

**Reset behavior:**
- "Reset to Auto" button (already exists in header) should also clear vector-specific orderings
- Per-role reset: right-click or menu option on role header → "Reset bullet order for this vector"

**Assembly integration:**
The assembler must use vector-specific ordering when building the preview and export. Order of operations:
1. Filter bullets by vector priority (include must + strong, conditionally include optional)
2. Sort included bullets by vector-specific order (or default)
3. Render in that order

### Acceptance Criteria
- [ ] Dragging bullets while "Security" is active saves order for Security only
- [ ] Switching to "Platform" shows Platform's order (or default if unset)
- [ ] Live preview reflects vector-specific ordering
- [ ] DOCX export respects vector-specific ordering
- [ ] Reset clears custom ordering

---

## Feature 3: DOCX Output Quality

### Problem
The DOCX export needs to produce a professional, ATS-parseable document that a recruiter won't reject on appearance alone. The current MVP likely has basic DOCX output — this feature ensures it's production-ready.

### Spec

**Target format: "Editorial Dense"** (matching the current resume style)

**Typography:**
- Font: Aptos, 10pt body text, 10.5pt name
- Section headers: ALL CAPS, bold, with horizontal rule underneath
- Consistent spacing: 40 twips after bullets, 80 twips after sections
- No orphan section headers (keep with next paragraph)

**Structure (ATS-critical):**
- No tables, no columns, no text boxes — pure flowing paragraphs
- Bullets use standard list formatting (not hacked with bullet characters in text)
- Section headers use proper heading styles (Heading 1 for sections, Heading 2 for roles) so ATS parsers can identify structure
- Role headers: **Company Name** — Title (right-aligned dates)
- No images, no graphics, no color (except maybe section header rules)

**Margins:** 0.75" left/right, 0.5" top/bottom (tight but professional)

**Page target:** 2 pages. The status bar should show estimated page count and warn yellow at 1.8 pages, red at 2+ pages.

**Character safety:**
- Sanitize all text: strip zero-width joiners, soft hyphens, BOM characters
- Use standard Unicode for em dashes (—), bullets (•), and quotes (" ")
- No `µ` symbol — spell out units ("microseconds" not "µs")

**Filename:** `{FirstName}{LastName}_Resume_{vectorLabel}.docx` (e.g., `NicholasFerguson_Resume_SecurityPlatform.docx`)

### Acceptance Criteria
- [ ] Exported DOCX opens correctly in Word, Google Docs, and LibreOffice
- [ ] ATS test: copy-paste from DOCX into plain text preserves all content and structure
- [ ] No hidden characters when extracting text (test with `pdftotext` after converting to PDF)
- [ ] Section headers parse correctly as headings (test with a DOCX parser)
- [ ] Page count matches preview estimate within 0.25 pages
- [ ] Filename includes vector label

---

## Feature 4: Save/Load Named Variants

### Problem
The user is applying to 24 companies, each potentially needing a slightly different configuration — not just which vector is active, but specific bullet toggling, reordering, and maybe a tweaked target line. They need to save a configuration as "Lumin-SRE", "Huntress-Security", "Brave-BuildEng" and recall it with one click.

### Spec

**Data model:**
```typescript
interface SavedVariant {
  id: string;
  name: string;                    // "Lumin-SRE"
  description?: string;            // "SRE-first framing, 80/20 SRE/SecArch"
  createdAt: string;               // ISO timestamp
  updatedAt: string;
  baseVector: string;              // which vector this is based on
  overrides: {
    includedBullets: string[];     // bullet IDs manually toggled on
    excludedBullets: string[];     // bullet IDs manually toggled off
    bulletOrders: {                // per-role bullet ordering overrides
      [roleId: string]: string[];
    };
    targetLineId?: string;         // specific target line override
    profileId?: string;            // specific profile override
    skillGroupOrder?: string[];    // custom skill group ordering
  };
}
```

**UI:**
- New "Saved Variants" section in the toolbar or as a dropdown next to the vector tabs
- "Save Current" button: saves the current vector + all manual overrides as a named variant
  - Prompts for name and optional description
  - If a variant with this name exists, offer to overwrite
- "Load" dropdown: shows all saved variants with name, base vector, last updated
- "Delete" via right-click or trash icon on the dropdown item
- Active variant name shows in the status bar: "Editing: Lumin-SRE (based on Security Platform)"

**Behavior:**
- Loading a variant sets the active vector AND applies all overrides
- Editing after loading a variant doesn't auto-save — user must explicitly "Save" to update
- Visual indicator (dot or asterisk) when a loaded variant has unsaved changes
- Variants are stored in localStorage alongside the component data
- Variants are included in JSON export/import

### Acceptance Criteria
- [ ] Can save current configuration as a named variant
- [ ] Can load a saved variant and have it restore vector + all overrides
- [ ] Unsaved changes indicator
- [ ] Variants persist across sessions (localStorage)
- [ ] Variants included in JSON import/export
- [ ] Can delete variants

---

## Feature 5: Skills Section Vector Routing

### Problem
Different roles care about different skills. A security platform role wants to see security tooling and networking skills first. A platform/DevEx role wants infrastructure and CI/CD first. The competencies section needs per-vector ordering *and* per-vector content selection.

### Spec

**Skill group vector properties:**
```typescript
interface SkillGroup {
  id: string;
  label: string;                           // "Languages", "Infrastructure", etc.
  content: string;                         // default content
  vectors: {
    [vectorId: string]: {
      priority: 'must' | 'strong' | 'optional' | 'exclude';
      order: number;                       // display order for this vector
      content?: string;                    // optional vector-specific content override
    };
  };
}
```

**Why content overrides matter:**
A security resume might want the Languages line to read "Python, Rust, C++, Bash, SQL" (leading with the security-relevant languages), while a platform resume wants "Python, C#/.NET, TypeScript, Bash, SQL" (leading with the platform-relevant languages). Same skill group, different ordering of the items within it.

**UI:**
- Each skill group card in the component library shows vector priority badges (same as bullets)
- Clicking a skill group opens an editor with:
  - Default content (always visible)
  - Per-vector content override (expandable, one per defined vector)
  - Per-vector priority and order number
- When editing content for a specific vector, show the default content as a grayed-out reference

**Assembly:**
1. Filter skill groups by vector priority (same as bullets)
2. Sort by vector-specific order
3. Use vector-specific content if defined, otherwise default
4. Render in order

### Acceptance Criteria
- [ ] Skill groups can be ordered differently per vector
- [ ] Skill groups can have vector-specific content (e.g., reordered skill items)
- [ ] Excluding a skill group for one vector doesn't affect other vectors
- [ ] Live preview updates skill section when switching vectors
- [ ] DOCX export uses correct vector-specific skill ordering and content

---

## Feature 6: JD Paste → Suggested Vector Weights

### Problem
The user has 24 target companies. For each one, they need to decide: which vector is primary? Which bullets should be must vs. optional? Which skills matter most? Currently this is manual judgment for every application. An AI analysis step could suggest a starting configuration based on a pasted job description.

### Spec

**Flow:**
1. User clicks "Analyze JD" button (new, in toolbar)
2. Modal opens with a large textarea: "Paste a job description"
3. User pastes JD and clicks "Analyze"
4. App sends the JD + the user's vector definitions + component library to Claude API
5. Claude returns:
   - Recommended primary vector
   - Suggested vector priority adjustments for specific bullets (e.g., "bullet X should be Must for this role")
   - Suggested target line (pick from existing or suggest edit)
   - Key skill matches and gaps (skills in JD not in user's skill groups)
   - Positioning note (1-2 sentences on unfair advantage angle)
6. Results display in a review panel:
   - Each suggestion is a toggleable checkbox — user accepts or rejects
   - "Apply Selected" button applies accepted suggestions as overrides
   - "Save as Variant" button saves the accepted configuration with the company name

**Claude API integration:**
- Use Anthropic API from the client (or proxy if API key management is needed)
- System prompt includes:
  - The user's vector definitions and descriptions
  - The user's full component library (all bullets, skills, profiles)
  - Instructions to return structured JSON with recommendations
- Model: claude-sonnet-4-20250514 (fast enough for interactive use)
- Response format: structured JSON matching a defined schema

**Prompt structure:**
```
You are a resume strategist. Given this job description and the candidate's 
resume component library, recommend:

1. primary_vector: which of the defined vectors best fits this role
2. bullet_adjustments: array of {bullet_id, recommended_priority, reason}
3. suggested_target_line: pick from existing or suggest modification
4. skill_gaps: skills mentioned in JD not present in candidate's skill groups
5. positioning_note: 1-2 sentence unfair advantage framing for this role

Respond in JSON only.
```

**UI for results:**
- Split into sections: Vector Recommendation, Bullet Adjustments, Skills Analysis, Positioning
- Each section collapsible
- Bullet adjustments show: bullet text preview, current priority → suggested priority, reason
- Skill gaps highlighted in red with suggestion to add
- "Apply & Save as Variant" primary action button

**Edge cases:**
- No API key configured → show setup instructions, don't crash
- API error → show error message, allow retry
- JD too short (<50 words) → warn but don't block
- Very long JD → truncate to fit context window with a note

### Acceptance Criteria
- [ ] Can paste a JD and receive AI-powered vector/priority recommendations
- [ ] Recommendations display as reviewable, toggleable suggestions
- [ ] User can selectively apply suggestions
- [ ] Applied suggestions can be saved as a named variant
- [ ] Skill gap analysis identifies JD requirements not in current skill groups
- [ ] Works without API key (graceful degradation — feature just disabled)
- [ ] Positioning note provides a useful framing angle

---

## Implementation Priority

Build in this order — each feature unlocks the next:

1. **Data Import/Export** — unblocks loading real content
2. **Bullet Reordering Per Vector** — makes variants actually different
3. **Skills Section Vector Routing** — completes the per-vector assembly
4. **DOCX Output Quality** — makes exports production-ready
5. **Save/Load Named Variants** — enables the multi-company workflow
6. **JD Paste → Suggested Weights** — AI analysis loop (most complex, least blocking)

## Technical Notes

- All state should flow through the existing Zustand store (or whatever state management the MVP uses)
- localStorage persistence for all new data (variants, orderings, settings)
- All new data included in JSON import/export round-trip
- No new dependencies unless essential — keep the bundle lean
- All features should work offline except Feature 6 (API call)

## Data Migration

The existing MVP likely has its own internal data shape. The import feature should handle:
- v0.1 format (whatever the MVP currently uses) → auto-upgrade to v0.2 schema
- Fresh v0.2 JSON import
- Store a `schemaVersion` field to enable future migrations
