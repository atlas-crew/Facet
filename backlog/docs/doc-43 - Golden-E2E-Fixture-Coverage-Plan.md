---
id: doc-43
title: Golden E2E Fixture Coverage Plan
type: specification
created_date: '2026-05-08 23:26'
updated_date: '2026-05-08 23:26'
tags:
  - fixtures
  - e2e
  - testing
  - golden-workspace
---
# Golden E2E Fixture Coverage Plan

## Purpose

Facet needs one deterministic, fictional workspace that proves the product works as a connected system, not only as route-local samples. The current sample lanes are useful but disconnected: Build has `defaultResumeData`, Pipeline has `samplePipelineData`, Identity has dev-only source-material samples, and persona fixtures stop at identity/resume/pipeline/prep.

This plan creates a reusable golden fixture spine for end-to-end tests, hosted Playwright mocks, persistence snapshots, and optionally a dev-only demo workspace loader.

## Canonical Seed Persona

Use **Maya Patel** as the seed persona.

Why Maya:

- Existing `buildMayaPatelPersona()` already includes a rich Identity model, resume data, pipeline entries, interview rounds, interviewer intel, and prep decks.
- Her Pillar Systems pipeline entry naturally exercises AppSec, JD analysis, interview prep, recruiter-facing language, cover letters, and debrief loops.
- The fixture is fictional and already follows the repo's persona validation pattern.

## Target Fixture Shape

Add a new builder, tentatively `buildMayaPatelGoldenWorkspace()`, that returns a complete test workspace object or `FacetWorkspaceSnapshot`-compatible payload containing:

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

This document is tracked by milestone `m-29` and the child tasks filed under the Golden E2E Fixture Coverage parent task.

## Open Questions

- Should the optional demo loader be dev-only, test-only, or user-visible behind an explicit "Load Demo Workspace" affordance?
- Should the golden fixture live under `src/test/fixtures/personas/` or a new `src/test/fixtures/goldenWorkspace.ts` module that composes personas plus downstream artifacts?
- Should Identity be folded into `FacetWorkspaceSnapshot`, or should golden E2E tests hydrate Identity separately because Identity currently persists outside workspace artifacts?
