# Vector Resume — Product Specification

## One-Liner
Strategic resume assembly tool that lets senior engineers define their career once and generate targeted resumes by positioning angle.

## Problem
Senior engineers applying to multiple types of roles (e.g., platform eng, security, build/release, leadership) maintain separate resume documents or do manual copy-paste surgery for each application. This is error-prone, time-consuming, and most people give up and send the same generic resume everywhere.

Existing tools solve the wrong problem:
- **Template tools** (Canva, Resume.io) — pretty layouts, zero strategy
- **AI rewriters** (Teal, Jobscan) — keyword-stuff against a JD, lose your voice
- **ATS optimizers** — score against a JD, don't help you assemble

None of them solve: "I have 5 positioning angles and 30+ career components. Help me assemble the right combination for this specific role."

## Solution
You define your career as a library of **tagged, prioritized components**. You define **vectors** (positioning angles). The tool assembles the right resume on demand.

---

## Core Concepts

### Vector
A positioning angle or narrative thread. Examples:
- "Backend Engineering"
- "Security Platform"
- "Engineering Leadership"
- "Developer Productivity"
- "Full-Stack Product"

A user defines their own vectors. Typically 2–6.

### Component
An atomic unit of resume content. Types:

| Type | What it is | Example |
|------|-----------|---------|
| `header` | Name, contact info, links | Always included |
| `target_line` | One-line positioning statement under name | "Sr. Platform Engineer \| Edge Security \| Rust / Python" |
| `profile` | 3–5 sentence summary paragraph | Different narrative per vector |
| `skill_group` | A labeled group of skills | "Languages: Python, Rust, Go" |
| `role` | Employer + title + dates (container for bullets) | "A10 Networks — Sr. Platform Engineer" |
| `bullet` | Single accomplishment under a role | The core content unit |
| `project` | Side/open-source project entry | Name + description + URL |
| `education` | Degree, school, year | Usually just one |

### Tags on Components

Every component (except `header` and `education`) carries:

```yaml
vectors: [security, platform]   # Which vectors this component is relevant to
priority: must | strong | optional | exclude
  # must    = always include when this vector is active
  # strong  = include unless at page limit
  # optional = include if space permits
  # exclude = never include for this vector
```

Priority can be **per-vector**:
```yaml
vectors:
  security: must
  platform: strong
  leadership: optional
```

### Variants
Some components have **vector-specific text variants**. Same accomplishment, different framing:

```yaml
- id: wayfair-bullet
  default: "Enabled a $1M enterprise contract by diagnosing Wayfair's failed sensor onboarding..."
  variants:
    security: "Diagnosed conntrack exhaustion under 150K+ RPS attack traffic, tuned Linux TCP stack..."
    platform: "Designed distributed load testing framework, built dynamic conntrack sizing..."
```

The assembly engine picks the right variant for the active vector, falling back to `default`.

### Skill Group Ordering
Skills groups don't change content per vector — they change **display order**. A security resume leads with security skills; a platform resume leads with infrastructure.

```yaml
skill_groups:
  - id: languages
    label: "Languages"
    content: "Python, C#/.NET, SQL, Bash, Rust, TypeScript"
    order:
      security: 3
      platform: 1
      default: 1
```

---

## Assembly Algorithm

When a user selects a vector:

1. **Filter**: Include all components tagged for this vector (respect priority)
2. **Select variants**: For each component with variants, pick the vector-specific variant (or default)
3. **Order skill groups**: Sort by vector-specific order
4. **Order bullets within each role**: Sort by priority for this vector (must → strong → optional)
5. **Page budget**: If assembled content exceeds 2 pages, trim from bottom (optional bullets first, then strong bullets from oldest role)
6. **Output**: Render to formatted document

### Page Budget Logic
- Target: 2 pages (configurable)
- Components are assembled top-down
- If over budget: drop `optional` bullets starting from oldest role, then `strong` from oldest role
- `must` bullets are never auto-dropped
- User gets a warning if must-tagged content alone exceeds page budget

---

## Data Format

User data is stored as a single YAML (or JSON) file:

```yaml
version: 1
meta:
  name: "Jane Smith"
  email: "jane@example.com"
  phone: "555-123-4567"
  location: "San Francisco, CA (Remote)"
  links:
    - label: github
      url: "github.com/janesmith"
    - label: linkedin
      url: "linkedin.com/in/janesmith"

vectors:
  - id: backend
    label: "Backend Engineering"
    color: "#3b9eff"     # UI color coding
  - id: platform
    label: "Platform / DevEx"
    color: "#2dd4a0"
  - id: leadership
    label: "Engineering Leadership"
    color: "#a78bfa"

target_lines:
  - id: tl-backend
    vectors: { backend: must }
    text: "Senior Backend Engineer | Distributed Systems | Go / Python | AWS"
  - id: tl-platform
    vectors: { platform: must }
    text: "Senior Platform Engineer | Developer Productivity | Internal Tools"

profiles:
  - id: profile-backend
    vectors: { backend: must, platform: strong }
    text: "Backend engineer who builds reliable distributed systems..."
  - id: profile-leadership
    vectors: { leadership: must }
    text: "Engineering leader who builds high-performing teams..."

skill_groups:
  - id: languages
    label: "Languages"
    content: "Go, Python, TypeScript, SQL, Rust"
    order: { backend: 1, platform: 2, default: 1 }
  - id: infrastructure
    label: "Infrastructure"
    content: "AWS, Kubernetes, Terraform, Docker, Linux"
    order: { backend: 2, platform: 1, default: 2 }

roles:
  - id: acme-corp
    company: "Acme Corp"
    title: "Senior Backend Engineer"
    dates: "Jan 2022 – Present"
    subtitle: null  # optional, e.g. "(acquired by BigCo)"
    bullets:
      - id: acme-b1
        vectors: { backend: must, platform: strong }
        text: "Designed and built the order processing pipeline..."
        variants:
          platform: "Built self-service order processing platform..."
      - id: acme-b2
        vectors: { backend: must }
        text: "Reduced P99 latency from 800ms to 120ms..."

projects:
  - id: proj-1
    name: "OpenThing"
    url: "github.com/jane/openthing"
    vectors: { backend: strong, platform: optional }
    text: "Distributed task queue library..."

education:
  - school: "UC Berkeley"
    location: "Berkeley, CA"
    degree: "B.S. Computer Science"
    year: "2018"
```

---

## User Interface

### Layout
Single-page web app. Three panels:

```
┌──────────────────────────────────────────────────────────┐
│  Vector Bar (sticky top)                                 │
│  [Backend] [Platform] [Leadership] [All] [+ New Vector]  │
├────────────────────────────┬─────────────────────────────┤
│                            │                             │
│  Component Library         │  Live Preview               │
│  (left panel, scrollable)  │  (right panel, PDF-like)    │
│                            │                             │
│  - Profile cards           │  Shows assembled resume     │
│  - Skill groups            │  as it would render         │
│  - Role + bullets          │  Updates live on selection   │
│  - Projects                │                             │
│                            │  Page count indicator       │
│  Each card shows:          │  [Download DOCX] [Download  │
│  - Text preview            │   PDF] [Copy Text]          │
│  - Vector tags (colored)   │                             │
│  - Priority badge          │                             │
│  - Include/exclude toggle  │                             │
│  - Drag handle for reorder │                             │
│                            │                             │
├────────────────────────────┴─────────────────────────────┤
│  Status bar: "2 pages | 14 bullets | 3 skills groups"    │
└──────────────────────────────────────────────────────────┘
```

### Key Interactions

1. **Select vector** → auto-assembles resume from tagged components
2. **Toggle component** → manually include/exclude, overriding auto-selection
3. **Drag to reorder** → within a role, reorder bullets; across skill groups, reorder display
4. **Edit inline** → click any component text to edit in place
5. **Switch variant** → dropdown on components with variants
6. **Add component** → modal form for new bullet/project/skill group
7. **Import/Export** → paste or upload YAML/JSON config

### Auto-Select vs Manual
When a vector is selected, the tool auto-selects components based on tags and priority. The user can then manually override (toggle on/off individual components). Manual overrides persist until the user clicks "Reset to Auto" or switches vectors.

---

## Output Formats

### DOCX (primary)
- Clean, ATS-friendly formatting
- No tables, no columns, no graphics
- Consistent font (system serif or sans-serif, user-configurable)
- Proper heading hierarchy for ATS parsing
- Unicode-safe (em dashes, bullets, etc.)

### PDF
- Generated from DOCX via headless LibreOffice (server-side) or browser print (client-side)

### Plain Text
- Clipboard-friendly plain text version for pasting into application forms

### Markdown
- For pasting into READMEs, portfolios, etc.

---

## Template System

The initial release ships with one template: **"Editorial Dense"** — the format from Nicholas Ferguson's resume (tight spacing, bold section headers with horizontal rules, bullet-heavy, no visual fluff).

Template is a separate module that receives assembled components and renders them. Future templates can be added without touching the assembly engine.

### Template Contract
A template receives:
```typescript
interface AssembledResume {
  header: HeaderData;
  targetLine?: string;
  profile: string;
  skillGroups: { label: string; content: string }[];  // pre-ordered
  roles: {
    company: string;
    title: string;
    subtitle?: string;
    dates: string;
    bullets: string[];  // pre-ordered, pre-variant-selected
  }[];
  projects: {
    name: string;
    url?: string;
    text: string;
  }[];
  education: {
    school: string;
    location: string;
    degree: string;
    year: string;
  }[];
}
```

And returns a rendered document (DOCX buffer, HTML string, or plain text).

---

## Technical Architecture

### Option A: Pure Client-Side (Recommended for v1)
- **React** single-page app
- YAML/JSON config stored in localStorage (with import/export)
- DOCX generation via `docx` npm library (runs in browser)
- PDF via browser print or a wasm-based converter
- No server needed, deploy to GitHub Pages / Vercel / Netlify
- Zero account creation, zero data leaves the browser

### Option B: With Server (v2 if needed)
- Server adds: LibreOffice PDF conversion, saved configs with shareable links, template marketplace
- But v1 should prove the concept client-side first

### Key Dependencies
- `docx` — OOXML document generation
- `js-yaml` — YAML parsing
- `react-beautiful-dnd` or similar — drag and drop
- `react-pdf` or iframe — live preview

---

## MVP Scope (v0.1)

Ship the smallest thing that's useful:

1. ✅ Define vectors
2. ✅ Define components (all types) with vector tags and priorities
3. ✅ Auto-assemble resume by vector selection
4. ✅ Manual include/exclude toggles
5. ✅ Bullet reordering within roles (drag and drop)
6. ✅ DOCX download
7. ✅ Import/export YAML config
8. ✅ One template ("Editorial Dense")
9. ✅ localStorage persistence
10. ✅ Page budget indicator (warns if >2 pages)

### Explicitly NOT in MVP
- User accounts / cloud storage
- Multiple templates
- AI-powered suggestions
- Job description parsing / keyword matching
- Collaboration / sharing
- PDF generation (use browser print-to-PDF)
- Variant editing UI (edit variants in YAML, import)

---

## File Structure

```
vector-resume/
├── public/
│   └── index.html
├── src/
│   ├── App.tsx                    # Root layout
│   ├── types.ts                   # TypeScript interfaces for all data
│   ├── store/
│   │   ├── resumeStore.ts         # Zustand store for resume data
│   │   └── uiStore.ts             # UI state (selected vector, panel sizes)
│   ├── engine/
│   │   ├── assembler.ts           # Core assembly algorithm
│   │   ├── pageBudget.ts          # Page estimation logic
│   │   └── serializer.ts          # YAML/JSON import/export
│   ├── templates/
│   │   ├── types.ts               # Template contract interface
│   │   └── editorialDense.ts      # Default template (docx generation)
│   ├── components/
│   │   ├── VectorBar.tsx           # Vector selector strip
│   │   ├── ComponentLibrary.tsx    # Left panel — all components
│   │   ├── ComponentCard.tsx       # Individual component card
│   │   ├── LivePreview.tsx         # Right panel — assembled preview
│   │   ├── SkillGroupList.tsx      # Orderable skill groups
│   │   ├── BulletList.tsx          # Orderable bullets within a role
│   │   ├── ImportExport.tsx        # YAML/JSON import/export modal
│   │   └── StatusBar.tsx           # Page count, component count
│   └── utils/
│       ├── docxRenderer.ts         # DOCX file generation
│       ├── textRenderer.ts         # Plain text output
│       └── markdownRenderer.ts     # Markdown output
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## Sample User Flow

1. **New user**: Lands on page → sees empty state with "Import Config" or "Start from Scratch"
2. **Import**: Pastes YAML → components populate the library
3. **Define vectors**: Clicks "+ New Vector", names it "Backend", picks a color
4. **Tag components**: Clicks a bullet → sets vector priority (must/strong/optional)
5. **Select vector**: Clicks "Backend" in the vector bar → resume auto-assembles in preview
6. **Tweak**: Drags a bullet higher, toggles off a weak project
7. **Download**: Clicks "Download DOCX" → gets a clean, ATS-ready file
8. **Switch**: Clicks "Platform" → different resume assembles instantly
9. **Export**: Clicks "Export Config" → saves YAML to share or version-control

---

## Success Metrics (if we ever care)

- **Primary**: User can go from YAML import to downloaded DOCX in < 2 minutes
- **Secondary**: User can switch vectors and download a meaningfully different resume in < 30 seconds
- **Quality**: Generated DOCX passes ATS parsing (test with Jobscan, Resume Worded)

---

## Name Options
- **Vector Resume** (working title)
- **Reforge** (resume + forge)
- **Assemble** 
- **Modular CV**
- **Angle** (positioning angle)

---

## Open Questions for Implementation

1. **Live preview rendering**: Render as styled HTML that approximates the DOCX output? Or render actual DOCX and display via PDF viewer? HTML is faster to iterate, PDF is more accurate.
2. **Page estimation**: Without actual DOCX rendering, how do we estimate pages? Character count heuristic? Render to hidden iframe and measure height?
3. **Variant editing**: For MVP, variants are edited in YAML and imported. Should the UI support inline variant editing, or is that v2?
4. **Bullet ordering persistence**: When a user manually reorders bullets for vector A, should that ordering persist separately from vector B's ordering? (Yes, probably.)
5. **Template hot-swapping**: Even in MVP, the template module should be swappable. Worth adding a template selector dropdown even with only one option, to establish the pattern?
