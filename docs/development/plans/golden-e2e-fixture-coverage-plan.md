# Golden E2E Fixture Coverage Plan

## Purpose

Facet needs one deterministic, fictional workspace that proves the product works as a connected system, not only as route-local samples. The current sample lanes are useful but disconnected: Build has `defaultResumeData`, Pipeline has `samplePipelineData`, Identity has dev-only source-material samples, and persona fixtures stop at identity/resume/pipeline/prep.

This plan creates a reusable golden fixture spine for end-to-end tests, hosted Playwright mocks, persistence snapshots, and optionally a dev-only demo workspace loader.

## Status

Closed 2026-05-09. `TASK-245` and every child task (`TASK-245.1` through `TASK-245.6`) are Done.

Delivered surfaces:

- `src/test/fixtures/goldenWorkspace.ts` composes the Maya/Pillar golden workspace.
- Golden fixture contract and round-trip tests cover cross-artifact links and snapshot hydration.
- Hosted Playwright fixtures can opt into the golden workspace without changing the default minimal hosted mocks.
- A deterministic cross-workspace E2E path exercises the connected Identity -> Research -> Pipeline -> JDAnalysis -> Build/Letters/Prep/Debrief graph.
- The dev-only backup/import flow exposes **Replace with Demo Workspace** behind `import.meta.env.DEV`.
- Maintenance docs explain how golden fixtures differ from route-local samples and small unit fixtures.

## Canonical Seed Persona

Use **Maya Patel** as the seed persona.

Why Maya:

- Existing `buildMayaPatelPersona()` already includes a rich Identity model, resume data, pipeline entries, interview rounds, interviewer intel, and prep decks.
- Her Pillar Systems pipeline entry naturally exercises AppSec, JD analysis, interview prep, recruiter-facing language, cover letters, and debrief loops.
- The fixture is fictional and already follows the repo's persona validation pattern.

## Target Fixture Shape

The shipped `buildMayaPatelGoldenWorkspace()` builder returns a complete test workspace object with a snapshot-compatible workspace payload containing:

- Identity: Maya's current professional identity.
- Resume: Maya's resume workspace, including at least one active resume entity and one pipeline-linked generated resume.
- Pipeline: Pillar Systems entry with JD text, research, rounds, interviewer intel, resume links, cover letter links, and prep links.
- JDAnalysis: canonical saved analysis linked by `pipelineEntryId` and `jdAnalysisId`, with audience-tagged fields shaped like production output.
- Cover Letters: one draft and one apply-time snapshot linked to the pipeline entry and source resume.
- Prep: existing Pillar Systems prep deck linked to the pipeline entry and round, with cards covering opener, technical, behavioral, landmine, and interviewer intel surfaces.
- Recruiter: one recruiter card generated from the canonical JDAnalysis projection.
- LinkedIn: one identity-derived draft to prove non-JD derived artifacts coexist in the same workspace.
- Debrief: one post-round session linked to the same pipeline entry/round, with story mappings and identity-draft correction hooks where supported.
- Research: one thesis, one request, one completed run, and one promoted result that ties back to the pipeline entry.

## Boundaries

- Keep all fixture content fictional.
- Do not introduce candidate-only facts in downstream artifacts that are not present in Identity.
- Pipeline remains the canonical owner of job context: JD text, JDAnalysis ID, research, rounds, resume/letter/prep links.
- Research fixtures represent upstream discovery; once promoted, enrichment lives on the Pipeline entry.
- In-app sample loaders can be added later, but test fixtures should not depend on product import dialogs.

## Validation Strategy

Required focused checks:

- Persona/golden fixture integrity test: cross-artifact IDs resolve and no dangling pipeline, round, resume, cover letter, prep, or analysis references remain.
- Snapshot round-trip test: golden workspace exports, validates, hydrates, and re-exports without losing required artifacts.
- Hosted Playwright mock path: hosted workspace mocks can serve the golden snapshot and at least one route can render the hydrated data.
- E2E semantic test: deterministic flow asserts Identity -> Research -> Pipeline -> JDAnalysis -> Build/Letters/Prep/Debrief links are present and usable without live AI.

## Rollout Tasks

Milestone: `m-29` Golden E2E Fixture Coverage.

Task graph:

```
TASK-245    Build golden E2E fixture coverage                 [done, parent]
   |
   +-- TASK-245.1  Add Maya golden fixture data artifacts      [done]
          |
          v
      TASK-245.2  Build golden workspace snapshot composer     [done]
          |
          +-- TASK-245.3  Use golden workspace in hosted Playwright fixtures  [done]
          +-- TASK-245.4  Add deterministic cross-workspace golden E2E test   [done]
          +-- TASK-245.5  Add optional dev demo workspace loader              [done]
          +-- TASK-245.6  Document golden fixture usage and maintenance       [done]
```

Implementation order:

1. `TASK-245.1` creates the missing downstream data for Maya.
2. `TASK-245.2` composes that data into a reusable golden workspace/snapshot and validates hydration.
3. `TASK-245.3`, `TASK-245.4`, `TASK-245.5`, and `TASK-245.6` can proceed in parallel after the composer lands.

All tasks followed this order and are complete.

## Decisions

- The optional demo loader is dev-only. It is exposed from the backup dialog's import mode as **Replace with Demo Workspace** and is guarded by `import.meta.env.DEV`.
- The golden fixture lives in `src/test/fixtures/goldenWorkspace.ts`, which composes persona data plus downstream artifacts into a reusable workspace snapshot.
- Identity stays outside `FacetWorkspaceSnapshot` for this slice. Golden tests and the dev loader hydrate Identity explicitly with the builder's Identity payload.

## Revision History

- **2026-05-08 v1**: initial golden E2E fixture coverage plan.
- **2026-05-09 v2**: rollout closed. `TASK-245` and `TASK-245.1` through `TASK-245.6` are Done; the plan now records the shipped builder, hosted fixture path, deterministic E2E coverage, dev demo loader, and maintenance docs.
