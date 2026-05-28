# Facet Feature Reference

> Archived v0.2 snapshot. This file is retained as historical context only and
> does not describe the current shipped product surface. Use
> `docs/reference/feature-reference.md` for the maintained feature inventory.

## Purpose

This document reflects the currently shipped feature surface in Facet and points to
the primary implementation files for each area.

## Scope

Current production-facing capabilities:

- Route-based workspace shell with Build, Pipeline, Research, Prep, Letters, and Help views
- Resume build workspace with import/export, component editing, vector include/exclude controls,
  JD analysis, live preview, PDF export, text output, presets, and theme editing
- Job pipeline tracking with filters, sorting, analytics, JSON import/export, and handoff into
  Build and Prep flows
- AI-assisted research profile inference and job search runs with result triage and pipeline push
- Interview prep decks with search/filtering, practice mode, JSON import/export, and AI generation
- Cover letter template editing and AI-assisted draft generation
- Persistence runtime with local hydration, sync status, encrypted backups, optional file save/load,
  and backup reminders

## Feature Behavior

### 1) Application Shell and Navigation

- The app uses a route-based shell rather than a single `App.tsx` entry screen.
- `/` redirects to `/build`.
- Main navigation exposes Build, Pipeline, Research, Prep, Letters, and Help.
- The shell shows persistence startup/sync status and opens the backup workflow.
- Appearance mode cycles between system, light, and dark.

Primary files:

- `src/router.tsx`
- `src/components/AppShell.tsx`
- `src/store/uiStore.ts`
- `src/routes/help/HelpPage.tsx`

### 2) Build Workspace

- Resume editing remains the core workspace.
- Users can edit metadata, target lines, profiles, projects, bullets, education,
  certifications, variables, and vector mappings.
- The component library supports add/edit/reorder flows plus include/exclude controls.
- Import/export supports text paste and file upload with replace and merge modes.
- Presets can be saved, loaded, and deleted, with dirty-state tracking.
- JD analysis supports selective apply and AI-assisted bullet reframing when an
  endpoint is configured.
- Output includes live preview, Typst PDF rendering/download, plain text, Markdown,
  and bundle export.
- Theme editing supports presets, token overrides, template/layout controls, and
  density adjustments.

Primary files:

- `src/routes/build/BuildPage.tsx`
- `src/components/ComponentLibrary.tsx`
- `src/components/ImportExport.tsx`
- `src/components/ThemeEditorPanel.tsx`
- `src/components/LivePreview.tsx`
- `src/components/PdfPreview.tsx`
- `src/engine/assembler.ts`
- `src/engine/importMerge.ts`
- `src/engine/serializer.ts`
- `src/themes/theme.ts`
- `src/utils/jdAnalyzer.ts`
- `src/utils/textRenderer.ts`
- `src/utils/markdownRenderer.ts`
- `src/utils/typstRenderer.ts`
- `src/templates/resume.typ`

### 3) Pipeline Tracking

- Pipeline entries capture company, role, URL, compensation, status, notes, job
  description, vector linkage, and activity history.
- Users can add/edit/delete entries, filter by tier/status/search, and sort by
  multiple columns.
- Analytics provide pipeline summaries without leaving the page.
- Pipeline JSON can be imported/exported, and legacy local data can be migrated.
- Pipeline entries can hand off into Build analysis and Prep generation flows.

Primary files:

- `src/routes/pipeline/PipelinePage.tsx`
- `src/routes/pipeline/PipelineFilters.tsx`
- `src/routes/pipeline/PipelineTable.tsx`
- `src/routes/pipeline/PipelineAnalytics.tsx`
- `src/routes/pipeline/PasteJdModal.tsx`
- `src/store/pipelineStore.ts`
- `src/utils/pipelineImport.ts`
- `src/store/handoffStore.ts`

### 4) Research

- Research can infer a search profile from resume data when AI is configured.
- Search requests track vector priorities, filters, and exclusions.
- Search runs persist status, logs, token usage, and grouped results.
- Closed/rejected pipeline companies are automatically excluded from future requests.
- Users can push promising results directly into the pipeline and jump back into Build.

Primary files:

- `src/routes/research/ResearchPage.tsx`
- `src/routes/research/researchUtils.ts`
- `src/store/searchStore.ts`
- `src/utils/searchExecutor.ts`
- `src/utils/searchProfileInference.ts`

### 5) Prep

- Prep decks organize interview material by company, role, vector, and linked
  pipeline entry.
- Users can create blank decks, edit cards, duplicate/remove cards, filter by
  category/vector/query, and import/export deck JSON.
- Practice mode supports rehearsal against the active deck.
- AI generation builds a prep deck from the selected pipeline entry, vector, job
  description, company research, and assembled resume context.

Primary files:

- `src/routes/prep/PrepPage.tsx`
- `src/routes/prep/PrepCardGrid.tsx`
- `src/routes/prep/PrepPracticeMode.tsx`
- `src/routes/prep/PrepSearch.tsx`
- `src/store/prepStore.ts`
- `src/utils/prepGenerator.ts`
- `src/utils/prepImport.ts`

### 6) Letters

- Cover letter workspaces are template-based.
- Users can create, edit, and delete reusable templates with paragraph-level vector
  controls.
- AI generation can create a new draft from the selected pipeline opportunity, vector,
  company research, and assembled resume context.
- Generated and manual templates persist in the cover letter store.

Primary files:

- `src/routes/letters/LettersPage.tsx`
- `src/store/coverLetterStore.ts`
- `src/utils/coverLetterGenerator.ts`
- `src/components/VectorPriorityEditor.tsx`

### 7) Persistence, Backup, and Sync

- The app starts through a shared persistence runtime before rendering the main workspace.
- Durable workspace content includes resume data, pipeline entries, prep decks,
  cover letter templates, and research state.
- Local-only preferences stay separate from synced workspace content.
- The shell exposes sync state in the footer.
- Encrypted workspace backup export/import uses passphrase-based WebCrypto.
- Supported browsers can save/load backups through File System Access; other browsers
  use download/upload fallback.
- Backup reminders appear when local changes are newer than the most recent file backup.
- The persistence contract is tenant-aware and can swap between local and remote backends.

Primary files:

- `src/components/AppShell.tsx`
- `src/components/WorkspaceBackupDialog.tsx`
- `src/components/WorkspaceBackupReminder.tsx`
- `src/persistence/runtime.ts`
- `src/persistence/hydration.ts`
- `src/persistence/contracts.ts`
- `src/persistence/coordinator.ts`
- `src/persistence/backupBundle.ts`
- `src/persistence/fileSystemAccess.ts`
- `src/persistence/backupReminder.ts`
- `src/persistence/remoteBackend.ts`
- `src/persistence/README.md`

## Data Model Notes

- Durable workspace artifacts include:
  - resume data
  - pipeline entries
  - prep decks
  - cover letter templates
  - research profile, requests, and runs
- Local-only preferences include UI appearance/state, backup reminder settings,
  pipeline sorting preferences, and the active prep deck selection.
- Workspace snapshots intentionally carry `tenantId`, `userId`, and `workspace`
  identity fields so the persistence contract does not need to change shape for
  hosted multi-tenant backends.
- Resume build data still carries theme state, presets, manual overrides,
  bullet-order overrides, and variable substitutions.

## Runtime Configuration

- Build-time AI features are enabled via `VITE_ANTHROPIC_PROXY_URL`.
- This affects JD analysis/reframing, research profile inference/search, prep
  generation, and cover letter generation.
- Invalid or unsafe endpoint values are sanitized/rejected before requests run.
- Authenticated remote persistence uses the proxy/backend contract documented in
  `src/persistence/README.md`.

## Verification

Run:

```bash
npm run typecheck
npm run test
npm run build
```

Optional full check:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Test Coverage Pointers

- `src/test/importMerge.test.ts`
- `src/test/serializer.test.ts`
- `src/test/jdAnalyzer.test.ts`
- `src/test/ThemeEditorPanel.test.tsx`
- `src/test/usePdfPreview.test.tsx`
- `src/test/typstRenderer.test.ts`
- `src/test/ResearchPage.test.tsx`
- `src/test/PrepPage.test.tsx`
- `src/test/PrepPracticeMode.test.tsx`
- `src/test/LettersPage.test.tsx`
- `src/test/persistence.test.ts`
- `src/test/persistenceRuntime.test.ts`
- `src/test/WorkspaceBackupDialog.test.tsx`
- `src/test/WorkspaceBackupReminder.test.tsx`
