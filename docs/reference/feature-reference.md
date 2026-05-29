# Facet Feature Reference

## Purpose

This document is the maintained inventory for Facet's currently shipped product
surface. It maps mounted routes, durable state owners, AI generators, persistence
boundaries, and representative tests to current source files.

## Route Inventory

Facet uses a TanStack Router shell in `src/router.tsx`. Route components live under
`src/routes/`, and the mounted route set currently includes 15 route directories:
`account`, `admin`, `build`, `debrief`, `help`, `home`, `identity`, `legal`,
`letters`, `linkedin`, `match`, `pipeline`, `prep`, `recruiter`, and `research`.

| Route                                                         | Surface                                                                                                                               | Primary files                                                                                                                                                                                                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                           | Home hub for resuming active work and choosing the next workspace.                                                                    | `src/routes/home/HomePage.tsx`, `src/store/identityStore.ts`, `src/store/pipelineStore.ts`, `src/store/prepStore.ts`, `src/store/matchStore.ts`                                                                                                         |
| `/identity`                                                   | Identity map canvas with deep links, band navigation, and inspector editing.                                                          | `src/routes/identity/IdentityMapPage.tsx`, `src/routes/identity/IdentityInspector.tsx`, `src/store/identityStore.ts`, `src/utils/mapSelectionUrl.ts`                                                                                                    |
| `/identity/import`                                            | Resume/source intake, identity extraction, scan review, draft application, and identity-to-resume push.                               | `src/routes/identity/IdentityPage.tsx`, `src/utils/identityExtraction.ts`, `src/utils/resumeScanner/index.ts`, `src/identity/resumeAdapter.ts`                                                                                                          |
| `/identity/enrich` and `/identity/enrich/$groupId/$skillName` | Skill enrichment queue and per-skill enrichment editor.                                                                               | `src/routes/identity/IdentityEnrichmentPage.tsx`, `src/routes/identity/IdentityEnrichmentSkillPage.tsx`, `src/utils/identityEnrichment.ts`                                                                                                              |
| `/match`                                                      | JD-to-identity match analysis, candidate-facing report, JDAnalysis save, and handoff into Build or Pipeline.                          | `src/routes/match/MatchPage.tsx`, `src/routes/match/matchPipeline.ts`, `src/store/matchStore.ts`, `src/utils/jobMatch.ts`, `src/utils/matchAssembler.ts`, `src/utils/jdAnalysis.ts`                                                                     |
| `/build`                                                      | Identity-first resume assembly, component editing, vectors, preview/export, PDF/DOCX output, theme editing, and JD-analysis handoffs. | `src/routes/build/BuildPage.tsx`, `src/components/ComponentLibrary.tsx`, `src/components/LivePreview.tsx`, `src/components/PdfPreview.tsx`, `src/components/ThemeEditorPanel.tsx`, `src/engine/assembler.ts`, `src/engine/serializer.ts`                |
| `/pipeline`                                                   | Opportunity tracker with saved filters, table/detail flow, analytics, JD analysis, investigation, imports, and Build/Prep handoffs.   | `src/routes/pipeline/PipelinePage.tsx`, `src/routes/pipeline/PipelineTable.tsx`, `src/routes/pipeline/PipelineDetail.tsx`, `src/routes/pipeline/PipelineAnalytics.tsx`, `src/routes/pipeline/PipelineJDAnalysisPanel.tsx`, `src/store/pipelineStore.ts` |
| `/research`                                                   | AI-assisted opportunity search, search profile inference, result triage, feedback, pipeline push, and artifact staleness review.      | `src/routes/research/ResearchPage.tsx`, `src/routes/research/researchUtils.ts`, `src/routes/research/stalenessRefreshHandlers.ts`, `src/store/searchStore.ts`, `src/utils/searchExecutor.ts`, `src/utils/searchProfileInference.ts`                     |
| `/prep`                                                       | Prep deck generation and editing, card search/filtering, practice mode, round metadata, context gaps, and debrief carry-over.         | `src/routes/prep/PrepPage.tsx`, `src/routes/prep/PrepCardGrid.tsx`, `src/routes/prep/PrepCardView.tsx`, `src/routes/prep/PrepPracticeMode.tsx`, `src/store/prepStore.ts`, `src/utils/prepGenerator.ts`                                                  |
| `/prep/live`                                                  | Focused live interview cheatsheet for the active prep deck.                                                                           | `src/routes/prep/PrepLivePage.tsx`, `src/routes/prep/PrepLiveMode.tsx`, `src/store/prepStore.ts`                                                                                                                                                        |
| `/letters`                                                    | Cover letter generation, template editing, paragraph refinement, drift handling, and PDF/DOCX export.                                 | `src/routes/letters/LettersPage.tsx`, `src/store/coverLetterStore.ts`, `src/utils/coverLetterGenerator.ts`, `src/utils/regen/coverLetterRegen.ts`, `src/utils/letterPdfRenderer.ts`                                                                     |
| `/linkedin`                                                   | LinkedIn profile and outreach draft generation from the identity model and optional job context.                                      | `src/routes/linkedin/LinkedInPage.tsx`, `src/store/linkedinStore.ts`, `src/utils/linkedinProfileGenerator.ts`                                                                                                                                           |
| `/recruiter`                                                  | One-page recruiter pitch cards generated from the active identity and JD analysis.                                                    | `src/routes/recruiter/RecruiterPage.tsx`, `src/store/recruiterStore.ts`, `src/utils/recruiterCardGenerator.ts`, `src/utils/recruiterCardPdfRenderer.ts`                                                                                                 |
| `/debrief`                                                    | Post-interview capture, story outcome tracking, AI debrief summaries, and identity correction-note generation.                        | `src/routes/debrief/DebriefPage.tsx`, `src/store/debriefStore.ts`, `src/utils/debriefGenerator.ts`, `src/utils/debriefIdentityDraft.ts`, `src/utils/debriefPatterns.ts`                                                                                 |
| `/account`                                                    | Hosted/self-hosted account state, AI access status, checkout, and sign-out.                                                           | `src/routes/account/AccountPage.tsx`, `src/store/hostedAppStore.ts`, `src/utils/hostedSession.ts`                                                                                                                                                       |
| `/admin`                                                      | Hosted operations console for webhooks, actors, workspaces, and billing diagnostics.                                                  | `src/routes/admin/AdminPage.tsx`, `src/utils/hostedApi.ts`, `src/utils/hostedSession.ts`, `src/utils/facetApiErrors.ts`                                                                                                                                 |
| `/terms` and `/privacy`                                       | Public legal pages for hosted use.                                                                                                    | `src/routes/legal/TermsPage.tsx`, `src/routes/legal/PrivacyPage.tsx`                                                                                                                                                                                    |
| `/help`                                                       | In-app markdown help browser for user guides.                                                                                         | `src/routes/help/HelpPage.tsx`, `src/routes/help/MermaidBlock.tsx`, `docs/user-guides/getting-started.md`                                                                                                                                               |

## Shared Subsystems

### Persistence

The canonical persistence overview is `src/persistence/README.md`. This reference
does not duplicate the persistence contract. Current source entry points include
`src/persistence/runtime.ts`, `src/persistence/hydration.ts`,
`src/persistence/contracts.ts`, `src/persistence/coordinator.ts`, and
`src/persistence/remoteBackend.ts`. Legacy encrypted-backup helpers remain in
`src/persistence/` for internal compatibility tests, but the backup/restore dialog
is no longer a shipped product surface.

Durable workspace stores currently include resume, identity, JD analysis, match,
pipeline, research, prep, cover letters, LinkedIn drafts, recruiter cards,
debrief sessions, feedback, hosted metadata, and UI state:

- `src/store/resumeStore.ts`
- `src/store/identityStore.ts`
- `src/store/jdAnalysisStore.ts`
- `src/store/matchStore.ts`
- `src/store/pipelineStore.ts`
- `src/store/searchStore.ts`
- `src/store/prepStore.ts`
- `src/store/coverLetterStore.ts`
- `src/store/linkedinStore.ts`
- `src/store/recruiterStore.ts`
- `src/store/debriefStore.ts`
- `src/store/feedbackStore.ts`
- `src/store/hostedAppStore.ts`
- `src/store/uiStore.ts`

### AI Features

The maintained AI inventory is `docs/reference/ai-feature-audit.md`. Runtime
configuration is read through `src/utils/facetEnv.ts`; client calls sanitize
endpoints with `src/utils/idUtils.ts` and use generator/executor utilities such
as:

- `src/utils/identityExtraction.ts`
- `src/utils/jobMatch.ts`
- `src/utils/jdAnalysis.ts`
- `src/utils/bulletReframing.ts`
- `src/utils/searchExecutor.ts`
- `src/utils/searchProfileInference.ts`
- `src/utils/thesisGenerator.ts`
- `src/utils/prepGenerator.ts`
- `src/utils/coverLetterGenerator.ts`
- `src/utils/linkedinProfileGenerator.ts`
- `src/utils/recruiterCardGenerator.ts`
- `src/utils/debriefGenerator.ts`

### Resume Assembly And Export

Resume assembly is centered in `src/engine/assembler.ts` with page-budget logic in
`src/engine/pageBudget.ts`, import/merge support in `src/engine/importMerge.ts`,
and serialization in `src/engine/serializer.ts`. Export utilities include
`src/utils/textRenderer.ts`, `src/utils/markdownRenderer.ts`,
`src/utils/typstRenderer.ts`, `src/utils/docxRenderer.ts`, and
`src/templates/resume.typ`.

### Identity, Pipeline, And Derived Artifacts

The load-bearing architecture rule is that identity owns canonical candidate data,
pipeline owns durable per-opportunity context, and downstream artifacts mirror or
project that state. See `docs/architecture/facet-workspace-topology.md` and
`docs/architecture/identity-canonical-data.md` before changing ownership
boundaries.

Current downstream artifact generators and adapters include
`src/identity/resumeAdapter.ts`, `src/utils/matchAssembler.ts`,
`src/utils/resumeGeneration.ts`, `src/utils/prepIdentityContext.ts`,
`src/utils/prepPipelineContext.ts`, `src/utils/coverLetterCandidate.ts`,
`src/utils/linkedinProfileGenerator.ts`, `src/utils/recruiterCardGenerator.ts`,
and `src/utils/debriefIdentityDraft.ts`.

## Test Coverage Pointers

Representative route, store, generator, persistence, and export tests:

- `src/test/HomePage.test.tsx`
- `src/test/IdentityPage.test.tsx`
- `src/test/IdentityMapPage.deepLink.test.tsx`
- `src/test/IdentityEnrichmentPage.test.tsx`
- `src/test/MatchPage.test.tsx`
- `src/test/BuildPage.test.tsx`
- `src/test/PipelinePage.test.tsx`
- `src/test/PipelineEntryModal.test.tsx`
- `src/test/PipelineJDAnalysisPanel.test.tsx`
- `src/test/ResearchPage.test.tsx`
- `src/test/PrepPage.test.tsx`
- `src/test/PrepPracticeMode.test.tsx`
- `src/test/PrepLiveMode.test.tsx`
- `src/test/LettersPage.test.tsx`
- `src/test/LinkedInPage.test.tsx`
- `src/test/RecruiterPage.test.tsx`
- `src/test/DebriefPage.test.tsx`
- `src/test/AccountPage.test.tsx`
- `src/test/AdminPage.test.tsx`
- `src/test/AppShell.test.tsx`
- `src/test/RouteErrorFallback.test.tsx`
- `src/test/persistence.test.ts`
- `src/test/persistenceRuntime.test.ts`
- `src/test/remotePersistenceBackend.test.ts`
- `src/test/workspaceBackup.test.ts`
- `src/test/jdAnalysis.test.ts`
- `src/test/jobMatch.test.ts`
- `src/test/prepGenerator.test.ts`
- `src/test/coverLetterGenerator.test.ts`
- `src/test/linkedinProfileGenerator.test.ts`
- `src/test/recruiterCardGenerator.test.ts`
- `src/test/debriefGenerator.test.ts`
- `src/test/assembler.test.ts`
- `src/test/importMerge.test.ts`
- `src/test/serializer.test.ts`
- `src/test/usePdfPreview.test.tsx`
- `src/test/typstRenderer.test.ts`
- `src/test/docxRenderer.test.ts`

## Verification Commands

For documentation-only edits, run targeted claim checks plus formatting:

```bash
npm run format:files:check -- docs/reference/feature-reference.md docs/NAVIGATOR.md docs/development/domain-model.md docs/development/agent-skills.md
```

For release gates, run:

```bash
npm run lint
npm run test
npm run build
```
