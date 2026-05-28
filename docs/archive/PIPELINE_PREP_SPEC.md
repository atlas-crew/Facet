# Facet Job Search Suite — Architecture & Implementation Spec

> Archived planning snapshot. Pipeline and Prep have shipped and evolved past this
> pre-implementation spec. Use `docs/reference/feature-reference.md`,
> `docs/development/domain-model.md`, and the architecture docs under
> `docs/architecture/` for current behavior.

> **Milestone:** m-4 — Job Search Suite
> **Status:** Ready for implementation
> **Prerequisites:** TanStack Router scaffolding is already merged. AppShell, sidebar nav, and route placeholders are in place.

---

## 1. What We're Building

Facet expands from a resume assembly tool into a three-part job search command center:

| Route       | Purpose                          | Status                                                     |
| ----------- | -------------------------------- | ---------------------------------------------------------- |
| `/build`    | Resume assembly (existing Facet) | ✅ Complete, relocated to `src/routes/build/BuildPage.tsx` |
| `/pipeline` | Application tracker & analytics  | 🔨 This spec                                               |
| `/prep`     | Interview reference cards        | 🔨 This spec                                               |

The key product insight: these aren't independent apps stitched together. Pipeline entries link to Facet vectors, JD analysis results flow from pipeline into the build view, and prep cards are tagged by vector so they surface contextually.

---

## 2. Routing (Already Done)

- **Router:** TanStack Router v1 (code-based, type-safe)
- **Config:** `src/router.tsx`
- **Shell:** `src/components/AppShell.tsx` — 48px icon sidebar, `<Outlet />`, footer
- **Routes:** `src/routes/{build,pipeline,prep}/`
- **Redirect:** `/` → `/build`

The appearance effect (dark/light/system → `data-theme` on `<html>`) is managed in `AppShell`, not in individual routes.

---

## 3. Design References

Mockups live in `docs/assets/mockups/`. These are the design targets — agents should match this visual language.

| Mockup                 | File                       | What it shows                                                                                                                                                                                        |
| ---------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pipeline table         | `pipeline-table.png`       | Funnel strip, tier/status filter pills, sortable table with status badges, search input, action buttons (Add/Import/Export/Analytics)                                                                |
| Pipeline analytics     | `pipeline-analytics.png`   | KPI cards (response rate, avg days, avg rounds, app→offer), horizontal bar breakdowns by tier/vector/method/rejection stage/format/variant                                                           |
| Prep cards (openers)   | `prep-cards-openers.png`   | Two-column card grid, category pills (All/Opener/Behavioral/Technical/Project/Metrics/Situational), CAUTION block (yellow), SAY THIS block (green accent + copy button), Q&A inset cards, tag badges |
| Prep cards (technical) | `prep-cards-technical.png` | SAY THIS block, collapsible deep-dive arrows (▸), metric badge strip (mono font, green accent), before/after comparison table                                                                        |
| Form density reference | `reference-dense-form.png` | reference dense-form dashboard — dark chrome, checkbox grid layout, input density. Use as tonal reference for pipeline entry modal form layout                                                       |

**Key design decisions visible in mockups:**

- **Pipeline filter pills** include a "Watch" tier in addition to T1/T2/T3 — add this to `PipelineTier` type
- **Pipeline analytics** uses horizontal bars (not the old HTML's text tables) with a `total / applied / responded` compact notation
- **Pipeline analytics** adds "App → Offer" conversion KPI not in original tracker
- **Prep categories** expand beyond the spec: add `'technical'` and `'situational'` to `PrepCategory`
- **Prep card layout** is two-column masonry-style (cards have variable height)
- **Status badges** use distinct colors per status (cyan for interviewing, red for rejected, green for applied, etc.)
- **Tier badges** are compact inline pills ("T1" with colored background, not the full word)

---

## 4. Pipeline Feature

### 3.1 Data Model

Create `src/types/pipeline.ts`:

```typescript
export type PipelineStatus =
  | 'researching' // Identified, not yet applied
  | 'applied' // Application submitted
  | 'screening' // Recruiter screen scheduled/completed
  | 'interviewing' // Active interview process
  | 'offer' // Offer received
  | 'accepted' // Offer accepted
  | 'rejected' // Rejected at any stage
  | 'withdrawn' // Candidate withdrew
  | 'closed' // Stale / no longer pursuing

export type PipelineTier = '1' | '2' | '3' | 'watch'

export type ApplicationMethod =
  | 'direct-apply'
  | 'referral'
  | 'recruiter-inbound'
  | 'recruiter-outbound'
  | 'cold-email'
  | 'linkedin'
  | 'unknown'

export type ResponseType =
  | 'none'
  | 'auto-reject'
  | 'human-reject'
  | 'screen-scheduled'
  | 'interview-scheduled'

export type InterviewFormat =
  | 'hr-screen'
  | 'tech-screen'
  | 'system-design'
  | 'take-home'
  | 'pair-programming'
  | 'behavioral'
  | 'presentation'
  | 'culture-fit'
  | 'hiring-manager'
  | 'team-match'

export type RejectionStage =
  | 'resume-screen'
  | 'recruiter-screen'
  | 'tech-screen'
  | 'onsite'
  | 'final-round'
  | 'offer-stage'
  | 'unknown'

export interface PipelineHistoryEntry {
  date: string // ISO date string
  note: string
}

export interface PipelineEntry {
  id: string
  company: string
  role: string
  tier: PipelineTier
  status: PipelineStatus
  comp: string // Free-text, e.g. "$170K–$210K"
  url: string // Job posting URL
  contact: string // Free-text, recruiter/contact name

  // ── Facet Integration ──
  vectorId: string | null // Links to a ResumeVector.id from resumeStore
  jobDescription: string // Raw JD text for analysis
  presetId: string | null // Links to a Preset.id from resumeStore
  resumeVariant: string // Free-text label of which resume version was sent

  // ── Positioning ──
  positioning: string // How to frame experience for this role
  skillMatch: string // Comma-separated relevant skills
  nextStep: string // Action item
  notes: string // General notes

  // ── Outcome Tracking ──
  appMethod: ApplicationMethod
  response: ResponseType
  daysToResponse: number | null
  rounds: number | null
  format: InterviewFormat[]
  rejectionStage: RejectionStage | ''
  rejectionReason: string
  offerAmount: string

  // ── Dates ──
  dateApplied: string // ISO date
  dateClosed: string // ISO date
  lastAction: string // ISO date — auto-updated on any mutation
  createdAt: string // ISO date

  // ── History ──
  history: PipelineHistoryEntry[]
}
```

### 3.2 Store

Create `src/store/pipelineStore.ts`:

- **Zustand** with `persist` middleware, key: `facet-pipeline-data`
- Uses the same `resolveStorage()` helper as existing stores
- **No undo/redo** — pipeline mutations are simple CRUD, not the complex priority math that needs undo in resumeStore

**State shape:**

```typescript
interface PipelineState {
  entries: PipelineEntry[]
  sortField: string
  sortDir: 'asc' | 'desc'
  filters: {
    tier: PipelineTier | 'all'
    status: PipelineStatus | 'all'
    search: string
  }

  // Actions
  addEntry: (entry: Omit<PipelineEntry, 'id' | 'createdAt' | 'lastAction' | 'history'>) => void
  updateEntry: (id: string, patch: Partial<PipelineEntry>) => void
  deleteEntry: (id: string) => void
  addHistoryNote: (id: string, note: string) => void
  setStatus: (id: string, status: PipelineStatus) => void
  setSort: (field: string, dir?: 'asc' | 'desc') => void
  setFilter: (key: keyof PipelineState['filters'], value: string) => void
  importEntries: (entries: PipelineEntry[]) => void
  exportEntries: () => PipelineEntry[]
}
```

**Migration:** Version 1, no migration needed since this is a new store. If the user has `pipeline-data` in localStorage from the old vanilla HTML version, offer a one-time import path (check for `localStorage.getItem('pipeline-data')` on first load).

### 3.3 Components

All in `src/routes/pipeline/`:

| Component                | Responsibility                                                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `PipelinePage.tsx`       | Route root. Layout: stats strip + filters + table/detail split                                                                           |
| `PipelineTable.tsx`      | Sortable table with expandable rows. Columns: Company, Role, Tier, Status, Comp, Last Action, Next Step                                  |
| `PipelineDetail.tsx`     | Expanded row or side panel: full entry fields, history timeline, action buttons                                                          |
| `PipelineFilters.tsx`    | Tier and status filter pills + search input                                                                                              |
| `PipelineStats.tsx`      | Funnel strip: Targets → Applied → Responded → Interviewing → Offers                                                                      |
| `PipelineAnalytics.tsx`  | Toggleable analytics panel: response rate, avg days, by-vector breakdown, by-method breakdown, skill frequency heatmap, rejection stages |
| `PipelineEntryModal.tsx` | Add/edit modal form with all PipelineEntry fields                                                                                        |

### 3.4 Analytics (Port from Existing)

The vanilla HTML tracker has a rich analytics panel. Port these computations:

1. **Funnel:** targets → applied → responded → interviewing → offers (5-cell strip)
2. **KPIs:** Response rate %, avg days to response, avg interview rounds
3. **By Vector:** For each vector referenced across entries — total, applied, responded, interviewing counts
4. **By Application Method:** Breakdown of direct-apply vs referral vs recruiter etc with response rates
5. **By Resume Variant:** Which resume versions get responses
6. **Rejection Stages:** Where in the funnel rejections happen
7. **Interview Formats:** Frequency of each format type encountered
8. **Skill Frequency:** Tag cloud/heatmap of skills across pipeline, weighted by tier and response rate

All analytics are computed as derived values (useMemo) from `pipelineStore.entries` — no separate analytics state.

### 3.5 Pipeline → Build Integration

This is the killer feature. Two flows:

**Flow A: Analyze JD from Pipeline**

1. User pastes JD into `PipelineEntry.jobDescription`
2. User clicks "Analyze in Builder" button on the entry
3. App navigates to `/build` via `router.navigate({ to: '/build' })`
4. The JD text and optional vectorId are passed via a lightweight shared store or URL search params
5. BuildPage reads this on mount, auto-opens the JD analyzer modal with the text pre-filled, and runs analysis

Implementation: Create a minimal `src/store/handoffStore.ts`:

```typescript
interface HandoffState {
  pendingJd: string | null
  pendingVectorId: string | null
  sourceEntryId: string | null
  consume: () => { jd: string; vectorId: string | null; entryId: string | null } | null
  setPendingAnalysis: (jd: string, vectorId?: string | null, entryId?: string | null) => void
}
```

Non-persisted Zustand store. BuildPage checks `handoffStore` on mount — if there's pending data, it opens the JD modal pre-filled. After consuming, it clears.

**Flow B: Save Preset Back to Pipeline**

After analyzing a JD and saving a preset in the build view, the preset ID can be written back to the pipeline entry via `pipelineStore.updateEntry(entryId, { presetId })`. The handoff store carries the `sourceEntryId` for this purpose.

### 3.6 Empty State & Data Import

The pipeline ships **empty** — no default data is bundled in the app. Personal job search data (company names, comp ranges, positioning notes) must never be committed to the repo.

On first load:

1. Check for legacy `localStorage.getItem('pipeline-data')` from the old vanilla HTML tracker. If found, offer a one-time import.
2. Otherwise, show an empty state with an "Import JSON" button and a brief description of what the pipeline does.

The user's existing data from `pipeline-tracker.html` should be exported from the old tracker (it already has an Export JSON button) and imported into the new app via the standard import flow.

For development/testing, create `src/routes/pipeline/samplePipelineData.ts` with 2-3 **fictional** placeholder entries (e.g. "Acme Corp", "Initech") that can be loaded via a "Load Sample Data" button in the empty state. This file contains zero real companies, people, or comp data.

---

## 5. Prep Feature

### 4.1 Data Model

Create `src/types/prep.ts`:

```typescript
export type PrepCategory =
  | 'opener' // Tell me about yourself, why leaving, etc.
  | 'behavioral' // Situational/behavioral questions
  | 'technical' // Architecture, system design deep dives
  | 'project' // Specific project stories
  | 'metrics' // Key numbers and stats
  | 'situational' // Scenario-based questions

export interface PrepDeepDive {
  title: string
  content: string // HTML-safe content (bold, code, br)
}

export interface PrepMetric {
  value: string // e.g. "450μs", "$1M", "38K+"
  label: string // e.g. "Full-stack latency"
}

export interface PrepFollowUp {
  question: string
  answer: string // HTML-safe
}

export interface PrepCard {
  id: string
  category: PrepCategory
  title: string // The question or topic, e.g. "Tell me about yourself"
  tags: string[] // Vector IDs and free-text tags for filtering
  // e.g. ['security', 'platform', 'rust', 'edgeprobe']

  // ── Content Blocks (all optional — cards vary in structure) ──
  script?: string // "Say This" — the rehearsed answer
  warning?: string // Caution / framing notes
  followUps?: PrepFollowUp[] // Q&A cards
  deepDives?: PrepDeepDive[] // Expandable technical details
  metrics?: PrepMetric[] // Number cards
  tableData?: {
    // For tables (memory budget, throughput)
    headers: string[]
    rows: string[][]
  }
}
```

### 4.2 Data Import — No Bundled Content

The interview-prep.html contains personal interview scripts, company-specific positioning, and proprietary project details. **None of this content ships in the app.** The prep feature launches empty.

Instead, the app supports importing prep data from a JSON file that conforms to the `PrepCard[]` schema. The user maintains their own prep data file outside the repo.

**Import/export flow:**

1. Prep page shows an empty state with "Import JSON" button on first load
2. User imports a `PrepCard[]` JSON file
3. Data persists to localStorage via a `prepStore` (or loaded fresh each time from file — TBD based on data size)
4. Export button to dump current cards back to JSON

**For development/testing,** create `src/routes/prep/samplePrepData.ts` with 3-5 **fictional** placeholder cards demonstrating each content block type (script, followUp, deepDive, metrics, table). Use generic examples like "Tell me about a challenging project" with lorem-style answers. Zero real project names, numbers, or company details.

**Extraction mapping (for the user's own data migration, NOT for bundling):**

The user will separately extract their prep data from the HTML file. The mapping for reference:

| HTML Pattern                                                       | PrepCard Field |
| ------------------------------------------------------------------ | -------------- |
| `<div class="section" id="...">`                                   | `id`           |
| `<span class="section-tag tag-*">`                                 | `category`     |
| `<h2>`                                                             | `title`        |
| `<div class="script">`                                             | `script`       |
| `<div class="warning">`                                            | `warning`      |
| `<div class="card"><div class="card-q">...<div class="card-a">...` | `followUps[]`  |
| `<details><summary>...<div class="detail-content">...`             | `deepDives[]`  |
| `<div class="numbers"><div class="num-card">...`                   | `metrics[]`    |
| `<table>`                                                          | `tableData`    |

### 4.3 Components

All in `src/routes/prep/`:

| Component              | Responsibility                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------- |
| `PrepPage.tsx`         | Route root. Search bar + category tabs + card grid                                     |
| `PrepCardGrid.tsx`     | Responsive grid of `PrepCardView` components                                           |
| `PrepCardView.tsx`     | Individual card: title, script preview, expandable follow-ups/deep-dives, metric strip |
| `PrepSearch.tsx`       | Search input + category filter pills + optional vector filter                          |
| `PrepPracticeMode.tsx` | (Stretch) Shuffled question display with hidden answers                                |

### 4.4 Prep → Pipeline Context

When a user navigates from a pipeline entry (e.g. "Prep for Huntress interview"), the prep page filters cards by matching tags:

1. Pipeline entry has `vectorId: 'security'` and tags from `skillMatch`
2. Navigate to `/prep?vector=security&skills=rust,linux,fleet`
3. PrepPage reads search params, pre-filters cards to show relevant stories

Implementation: Use TanStack Router search params validation:

```typescript
const prepRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/prep',
  component: PrepPage,
  validateSearch: (search) => ({
    vector: (search.vector as string) ?? '',
    skills: (search.skills as string) ?? '',
    q: (search.q as string) ?? '',
  }),
})
```

---

## 6. Design System Adoption

Both new routes use the existing CSS custom property system from `index.css`. No new design tokens needed. Key decisions:

- **Font stack:** `var(--font-sans)` for UI, `var(--font-mono)` for data/labels (same as build view)
- **Spacing:** 4px grid (`var(--space-1)` through `var(--space-8)`)
- **Colors:** `var(--bg-primary)`, `var(--bg-surface)`, `var(--border-subtle)`, etc.
- **Icons:** `lucide-react` only
- **Dark mode:** Automatic via `[data-theme="dark"]` — use CSS vars, never hardcode colors
- **Scrollbar styling:** Apply `.left-panel-body` scrollbar pattern to any scrollable containers

**Do NOT** carry over the IBM Plex / Source Serif fonts or the GitHub-dark color palette from the original HTML files. Everything adopts Facet's existing design language.

---

## 7. Conventions & Guardrails

These match the existing codebase (see `CLAUDE.md`):

1. **Strict TypeScript** with `verbatimModuleSyntax` — use `import type` for type-only imports
2. **No vitest globals** — always import `describe`, `it`, `expect` from `vitest`
3. **Immutable state updates** in Zustand — spread/map, never mutate
4. **CSS custom properties** for all visual values — no inline hex colors
5. **4px spacing grid**
6. **IDs:** Use `createId(prefix)` from `src/utils/idUtils.ts` for all new entity IDs
7. **Commit via `committer`**, delete via `trash`
8. **Tests** in `src/test/` using Vitest with jsdom

---

## 8. File Structure (Target)

```
src/
├── router.tsx                           # TanStack Router config
├── main.tsx                             # RouterProvider entry
├── index.css                            # Global styles (already has sidebar CSS)
├── types.ts                             # Existing resume types
├── types/
│   ├── pipeline.ts                      # Pipeline types
│   └── prep.ts                          # Prep types
├── store/
│   ├── resumeStore.ts                   # Existing (unchanged)
│   ├── uiStore.ts                       # Existing (unchanged)
│   ├── pipelineStore.ts                 # NEW
│   └── handoffStore.ts                  # NEW — JD analysis handoff
├── components/
│   ├── AppShell.tsx                     # Root layout (done)
│   ├── FacetWordmark.tsx                # Extracted brand mark (done)
│   └── ... (existing components)
├── routes/
│   ├── build/
│   │   └── BuildPage.tsx                # Existing App.tsx content (done)
│   ├── pipeline/
│   │   ├── PipelinePage.tsx             # Route root
│   │   ├── PipelineTable.tsx
│   │   ├── PipelineDetail.tsx
│   │   ├── PipelineFilters.tsx
│   │   ├── PipelineStats.tsx
│   │   ├── PipelineAnalytics.tsx
│   │   ├── PipelineEntryModal.tsx
│   │   ├── samplePipelineData.ts        # Fictional test data only
│   │   └── pipeline.css                 # Route-specific styles
│   └── prep/
│       ├── PrepPage.tsx                 # Route root
│       ├── PrepCardGrid.tsx
│       ├── PrepCardView.tsx
│       ├── PrepSearch.tsx
│       ├── samplePrepData.ts            # Fictional test data only
│       └── prep.css                     # Route-specific styles
```

---

## 9. Task Breakdown

### TASK-23: Create pipelineStore

**Priority:** High | **Estimate:** Small

- Define all types in `src/types/pipeline.ts`
- Implement `pipelineStore` with Zustand persist
- Implement `handoffStore` (non-persisted)
- Extract default data from `pipeline-tracker.html` into `defaultPipelineData.ts`
- Write migration check for legacy `pipeline-data` localStorage key
- Unit tests for store CRUD operations

### TASK-24: Build Pipeline UI

**Priority:** High | **Estimate:** Large

- `PipelinePage` layout: stats strip top, filters below, table body
- `PipelineTable` with sort-by-column, expandable rows
- `PipelineDetail` expanded row showing all fields + history timeline
- `PipelineFilters` tier/status pills + search
- `PipelineStats` funnel strip (targets/applied/responded/interviewing/offers)
- `PipelineAnalytics` toggleable panel with all 8 analytics views (see §3.4)
- `PipelineEntryModal` add/edit form
- Status quick-change dropdown on table rows
- Import/export JSON
- CSS in `pipeline.css`, imported by PipelinePage
- Responsive: stack on mobile

### TASK-25: Wire Pipeline → Build integration

**Priority:** High | **Estimate:** Medium

- "Analyze in Builder" button on pipeline entries with JD text
- Handoff via `handoffStore.setPendingAnalysis()`
- `BuildPage` reads handoff on mount, opens JD modal pre-filled
- After preset save, write presetId back to pipeline entry
- "Open in Builder" button that navigates to `/build` and selects the linked vector
- Update `router.tsx` if search params needed

### TASK-26: Extract interview prep data

**Priority:** Medium | **Estimate:** Medium

- Parse all ~30 sections from `interview-prep.html`
- Create `PrepCard[]` array in `prepData.ts` with proper typing
- Manually assign vector tags to each card
- Ensure all content blocks (scripts, warnings, followUps, deepDives, metrics, tables) are captured
- No runtime HTML parsing — this is a one-time manual extraction into typed data

### TASK-27: Build Prep UI

**Priority:** Medium | **Estimate:** Medium

- `PrepPage` layout: search bar + category tabs + card grid
- `PrepSearch` with text search + category filter pills
- `PrepCardGrid` responsive grid
- `PrepCardView` card component with collapsible sections
- "Script" blocks with copy-to-clipboard
- "Deep Dive" sections as expandable accordions
- Metric strips as horizontal badge rows
- Tables rendered natively
- CSS in `prep.css`

### TASK-28: Wire Prep → Pipeline context

**Priority:** Low | **Estimate:** Small

- "Prep for Interview" button on pipeline entries → navigates to `/prep?vector=X&skills=Y`
- PrepPage reads search params via TanStack Router `validateSearch`
- Auto-filter cards by matching tags against vector + skills
- Clear filters button to see all cards
- Update `router.tsx` with search param validation on prep route

### TASK-29: Fix splitter ratio for sidebar offset

**Priority:** Low | **Estimate:** Trivial

- In `BuildPage.tsx`, the splitter drag handler uses `event.clientX / window.innerWidth`
- Should be `(event.clientX - SIDEBAR_WIDTH) / (window.innerWidth - SIDEBAR_WIDTH)` where `SIDEBAR_WIDTH = 48`
- Also update initial `panelRatio` calculation if it uses window width

---

## 10. Source Material Locations

These files are reference for **feature design and data schema** only. They contain the user’s real personal data (company names, comp ranges, interview scripts, positioning notes) which must NEVER be copied into source code.

- **Pipeline feature reference:** `/mnt/user-data/uploads/pipeline-tracker.html` (1422 lines)
  - Data schema (field names/types): lines 774–794 (DEFAULT_DATA shape)
  - CRUD logic to port: lines 807–1175
  - Analytics computations to port: lines 1241–1415
  - Filter/sort logic to port: lines 831–895
  - Table rendering patterns: lines 896–997
  - ⚠️ The actual data values in DEFAULT_DATA are personal — only use the field structure as reference

- **Interview prep feature reference:** `/mnt/user-data/uploads/interview-prep.html` (1067 lines)
  - Section structure (categories, content block patterns): lines 424–478
  - Content block types to support: lines 481–1036
  - Section types: opener, behavioral, current-role, prior-role, earlier-role, deep-dive, numbers
  - ⚠️ All section content is personal interview prep material — only use the HTML patterns to define PrepCard schema

---

## 11. Personal Data Migration (Not Part of App)

To load your own data into the new app:

**Pipeline:** Open the old `pipeline-tracker.html` in a browser, click "Export JSON", save the file. Then import it into the new Pipeline view. The schema is compatible — the store’s import function should accept the old format directly (same field names). If there are minor mismatches, the import validator should warn and skip bad fields rather than reject the whole file.

**Prep:** The interview-prep.html needs a one-time conversion from HTML sections to `PrepCard[]` JSON. This can be done as a separate script (outside the repo) or manually. The extraction mapping table in §4.2 documents how HTML patterns map to PrepCard fields. The resulting JSON file lives outside the repo and gets imported at runtime.

---

## 12. What NOT to Do

- **Don't restructure the existing build route.** BuildPage.tsx works. Don't touch it except for the handoff integration (TASK-25) and splitter fix (TASK-29).
- **Don't add a top-level layout change.** The sidebar nav is done. Don't add a top bar, breadcrumbs, or any other chrome.
- **Don't create a shared "component library" or "design system package."** Just use the CSS vars. This isn't a monorepo.
- **Don't over-engineer the prep feature.** It's reference content with search/filter. No database, no editing, no user-generated content (yet).
- **Don't make pipeline entries aware of assembly internals.** The integration boundary is: vectorId, jobDescription text, and presetId. Pipeline doesn't need to know about bullets, priorities, or page budgets.
- **Don't bundle any real personal data in the app.** The HTML source files (`pipeline-tracker.html`, `interview-prep.html`) contain real company names, comp ranges, positioning notes, interview scripts, and contact info. None of that goes into source code. Sample/test data must be entirely fictional ("Acme Corp", generic questions). The user imports their real data at runtime via JSON import.
- **Don't introduce new dependencies** beyond what's already in package.json (except `@tanstack/react-router` which is already added). Use lucide-react for icons, plain CSS for styles.
