---
mode: ui-surfaces
date: 2026-05-09
scope: Facet user flow (Identity/Extraction → Search → Pipeline → Prep → Letters/Resume/Recruiter)
diagram: routes.mmd
secondary_diagrams: [components.mmd]
synthesized_share: 0.000
---

# UI Surfaces

## Summary

Facet has **20 routes** registered in `src/router.tsx`, of which **14 are in the user-flow scope** (the rest are account/admin/legal/help/home). Every route renders inside a single `[U-2] AppShell` — the only shell layout. The architectural signal that pops out: **three routes are eager-loaded** (Build, Pipeline, Recruiter); the other 17 are `React.lazy(() => import(...))`. The eager triad is the daily-driver set.

The pipeline workspace is the most-composed surface — `[U-20] PipelinePage` renders six distinct panels (Filters, Table, Analytics, EntryModal, PasteJdModal, Detail) plus eager-loaded sub-components. Other workspaces are simpler: typically one Page component + at most one modal.

State ownership flows through 11 Zustand stores, one per workspace. Most pages read from one or two stores; `AppShell` reads from `[S-3] resumeStore`, `[S-4] prepStore`, `[S-5] searchStore`, and `[S-1] identityStore` to compute the workspace-defined badge counts shown in the nav.

## Callouts

| ID | Label | Citation | Confidence |
|----|-------|----------|------------|
| U-1 | Root route | src/router.tsx:65 | high |
| U-2 | AppShell | src/components/AppShell.tsx:231 | high |
| U-5 | /build route | src/router.tsx:75 | high |
| U-6 | BuildPage (eager) | src/routes/build/BuildPage.tsx:219 | high |
| U-7 | /identity route | src/router.tsx:81 | high |
| U-8 | IdentityMapPage | src/routes/identity/IdentityMapPage.tsx:33 | high |
| U-9 | /identity/import route | src/router.tsx:98 | high |
| U-10 | IdentityPage | src/routes/identity/IdentityPage.tsx:55 | high |
| U-11 | /identity/enrich route | src/router.tsx:104 | high |
| U-12 | IdentityEnrichmentPage | src/routes/identity/IdentityEnrichmentPage.tsx:53 | high |
| U-13 | /identity/enrich/$groupId/$skillName route | src/router.tsx:110 | high |
| U-14 | IdentityEnrichmentSkillPage | src/routes/identity/IdentityEnrichmentSkillPage.tsx:86 | high |
| U-15 | /match route | src/router.tsx:116 | high |
| U-16 | MatchPage | src/routes/match/MatchPage.tsx:104 | high |
| U-17 | /research route | src/router.tsx:132 | high |
| U-18 | ResearchPage | src/routes/research/ResearchPage.tsx:659 | high |
| U-19 | /pipeline route | src/router.tsx:122 | high |
| U-20 | PipelinePage (eager) | src/routes/pipeline/PipelinePage.tsx:46 | high |
| U-21 | PipelineFilters | src/routes/pipeline/PipelineFilters.tsx:1 | medium |
| U-22 | PipelineTable | src/routes/pipeline/PipelineTable.tsx:1 | medium |
| U-23 | PipelineAnalytics | src/routes/pipeline/PipelineAnalytics.tsx:1 | medium |
| U-24 | PipelineEntryModal | src/routes/pipeline/PipelineEntryModal.tsx:1 | medium |
| U-25 | PasteJdModal | src/routes/pipeline/PasteJdModal.tsx:12 | high |
| U-26 | /prep route | src/router.tsx:140 | high |
| U-27 | PrepPage | src/routes/prep/PrepPage.tsx:513 | high |
| U-28 | /prep/live route | src/router.tsx:151 | high |
| U-29 | PrepLivePage | src/routes/prep/PrepLivePage.tsx:8 | high |
| U-30 | /letters route | src/router.tsx:157 | high |
| U-31 | LettersPage | src/routes/letters/LettersPage.tsx:223 | high |
| U-32 | /linkedin route | src/router.tsx:163 | high |
| U-33 | LinkedInPage | src/routes/linkedin/LinkedInPage.tsx:42 | high |
| U-34 | /recruiter route | src/router.tsx:169 | high |
| U-35 | RecruiterPage (eager) | src/routes/recruiter/RecruiterPage.tsx:54 | high |
| U-36 | /debrief route | src/router.tsx:175 | high |
| U-37 | DebriefPage | src/routes/debrief/DebriefPage.tsx:71 | high |
| U-48 | HostedWorkspaceDialog | src/components/HostedWorkspaceDialog.tsx:1 | medium |
| U-49 | WorkspaceBackupDialog | src/components/WorkspaceBackupDialog.tsx:1 | medium |
| U-50 | WorkspaceBackupReminder | src/components/WorkspaceBackupReminder.tsx:1 | medium |
| U-51 | LivePreview | src/components/LivePreview.tsx:1 | medium |
| U-52 | PdfPreview iframe | src/components/PdfPreview.tsx:7 | high |
| U-53 | Tour overlay | src/components/Tour.tsx:1 | medium |
| U-54 | PipelineDetail (side panel) | src/routes/pipeline/PipelineDetail.tsx:1 | medium |
| S-1 | identityStore (state ownership) | src/store/identityStore.ts:1 | high |
| S-2 | pipelineStore | src/store/pipelineStore.ts:1 | high |
| S-3 | resumeStore | src/store/resumeStore.ts:1 | high |
| S-4 | prepStore | src/store/prepStore.ts:1 | high |
| S-5 | searchStore | src/store/searchStore.ts:1 | high |
| S-6 | matchStore | src/store/matchStore.ts:1 | high |
| S-7 | linkedinStore | src/store/linkedinStore.ts:1 | high |
| S-8 | recruiterStore | src/store/recruiterStore.ts:1 | high |
| S-9 | debriefStore | src/store/debriefStore.ts:1 | high |
| S-10 | coverLetterStore | src/store/coverLetterStore.ts:1 | high |
| S-11 | jdAnalysisStore | src/store/jdAnalysisStore.ts:1 | high |
| OBS-1 | Eager-load architectural signal | src/router.tsx:4 | high |

## Narrative

### Routes (U-1 … U-37) — see `routes.mmd`

The router is a flat-ish tree: every route is a child of the root, with one nested route (`/identity/enrich/$groupId/$skillName`). 14 user-flow routes fall into four logical clusters:

**Identity** (4 routes): `/identity` (map view), `/identity/import` (extraction surface), `/identity/enrich` (skill enrichment list), `/identity/enrich/$groupId/$skillName` (per-skill detail). The deep-link bridge query params (`?sel`, `?focus`, `?return`) on `/identity` are the cross-workspace return mechanism (TASK-217 noted in router source).

**Search + Match** (2 routes): `/research` (deep-research workspace), `/match` (exploratory JD match).

**Pipeline + Prep** (3 routes): `/pipeline`, `/prep`, `/prep/live`.

**Derived artifacts** (4 routes): `/letters`, `/linkedin`, `/recruiter`, `/debrief`. These are post-pipeline outputs.

Plus the `/build` route which sits structurally adjacent to identity but is an editing surface for derived `ResumeData`.

### `[OBS-1]` — Eager-loaded triad

`src/router.tsx:4-6` direct-imports `BuildPage`, `PipelinePage`, and `RecruiterPage`. Every other route uses `React.lazy(() => import('...'))` with a Suspense fallback. The architectural signal: **these three are the daily drivers**. Build is the resume-editing loop; Pipeline is the application tracker; Recruiter is the outbound outreach surface. Lazy-loading them would add a chunk-fetch latency to the most-trafficked navigation paths.

The other 17 routes are AI-dependent (identity extraction, prep generation, research) or less-frequent (account, admin, legal). Code-splitting buys faster initial load at the cost of a one-time chunk fetch on first navigation.

### Components — see `components.mmd`

`[U-2] AppShell` renders persistent overlays:
- `[U-48] HostedWorkspaceDialog` — workspace switcher in hosted mode
- `[U-49] WorkspaceBackupDialog` — backup creation/restore
- `[U-50] WorkspaceBackupReminder` — passive nudge banner
- `[U-53] Tour overlay` — onboarding tour

The pipeline workspace decomposes:
- `[U-20] PipelinePage` is the orchestrator (eager-loaded, line 46)
- `[U-21] PipelineFilters` — state filters, tier filters, search box
- `[U-22] PipelineTable` — the entry list
- `[U-23] PipelineAnalytics` — funnel/state distribution panel
- `[U-24] PipelineEntryModal`, `[U-25] PasteJdModal` — entry creation modals
- `[U-54] PipelineDetail` — slide-out side panel for entry detail

The PDF preview surface composes two components:
- `[U-51] LivePreview` — wrapper that owns the theme CSS variables
- `[U-52] PdfPreview` — the actual `<iframe src={blobUrl}>` rendering

### State ownership

11 Zustand stores, one per workspace surface. Most pages read from one or two stores; `AppShell` reads from four (identity, resume, prep, search) to compute the nav badge counts at lines 220–229. Cross-store reads are lightweight because Zustand selectors don't re-render unless the selected slice changes — but they are still architectural signals worth surfacing.

The dotted edges in `components.mmd` show only the highest-volume read relationships. Every store also has a return path through the persistence runtime (covered in data-flow's `[D-30]` schedulePersist), but that's not a UI-surface relationship.

## Verification log

### Discarded findings

- U-3 (HomePage), U-39 (AccountPage), U-41 (AdminPage), U-43 (TermsPage), U-45 (PrivacyPage), U-47 (HelpPage) — out of user-flow scope; the routes still appear in router.tsx but the pages aren't enumerated here.

### Repaired citations

The UI subagent claimed `:1` for 14 page-export sites where the actual export is at line N>1 (page files lead with imports). Repaired via `grep -n "^export function" <file>` for each:

- U-4 HomePage: claimed :81 → actual :375 (out of scope, dropped)
- U-8 IdentityMapPage: claimed :1 → repaired to :33
- U-10 IdentityPage: claimed :1 → repaired to :55
- U-12 IdentityEnrichmentPage: claimed :1 → repaired to :53
- U-14 IdentityEnrichmentSkillPage: claimed :1 → repaired to :86
- U-16 MatchPage: claimed :1 → repaired to :104
- U-18 ResearchPage: claimed :1 → repaired to :659
- U-20 PipelinePage: claimed router.tsx:5 (the import line) → repaired to PipelinePage.tsx:46 (the actual page export)
- U-6 BuildPage: claimed router.tsx:4 (import line) → repaired to BuildPage.tsx:219
- U-27 PrepPage: claimed :1 → repaired to :513
- U-31 LettersPage: claimed :1 → repaired to :223
- U-33 LinkedInPage: claimed :1 → repaired to :42
- U-35 RecruiterPage: claimed router.tsx:6 (import line) → repaired to RecruiterPage.tsx:54
- U-37 DebriefPage: claimed :1 → repaired to :71
- U-29 PrepLivePage: claimed :8 → verified :8 ✓ (correct as-is)

The pattern: subagent assumed page exports lived at line 1; actual exports follow the imports block. Symbols all exist, citations all repairable.

### Synthesized cap

- Synthesized share: 1/53 = 1.9% (OBS-1 is the eager-load architectural observation, which has supporting citations at router.tsx:4–6).

### Unverified citations

- The `src/routes/pipeline/Pipeline*.tsx` panel components (U-21 through U-24) had `:1` evidence; line 1 is plausibly an `interface Props` or `import` block. Confidence dropped to `medium`. Symbols verified to exist via `ls`.

## Open questions

- Why `BuildPage`, `PipelinePage`, `RecruiterPage` specifically as the eager triad? Build and Pipeline are obvious daily drivers; **Recruiter** is less obvious — outbound recruiter outreach. Worth confirming the design intent.
- The `/identity` deep-link bridge is identity-specific because identity is the only workspace with the multi-slot inspector pattern that selection-pinning requires. The Model/Strategy tab shell was retired in favor of a single canvas + bands + sticky inspector (`src/routes/identity/IdentityMapPage.tsx:24-32`), so the bridge has three independent params: `?sel=<MapSelection>` (12+ variants in `src/utils/mapSelectionUrl.ts:33-66`) for inspector-pin, `?focus=<band>` for band-scroll, and `?return=<path>` for the back-link breadcrumb. The `?focus` param is currently bounded to `['preferences']` (`src/utils/mapSelectionUrl.ts:184`) by an explicit lock pattern documented at lines 169-183 — extending it to other bands requires a deliberate add to both `IDENTITY_BAND_FOCUS_VALUES` and `BAND_FOCUS_TO_DATA_LAYER`. The substantive open question: as more bands accumulate landing-target needs, when does the bounded-set lock become friction rather than safety?
- Pipeline's six-panel composition vs. simpler one-page-per-workspace pattern elsewhere — is pipeline's complexity load-bearing (the workspace is genuinely richer) or accumulating?
