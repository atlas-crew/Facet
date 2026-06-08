---
id: adr-0002
title: Pipeline owns durable job context
date: 2026-05-02
status: accepted
---

## Context

Facet has multiple workspaces (Build, JD Match, Letters, Prep, Pipeline, Research) that all touch some aspect of "this job application." Until now there has been no canonical owner of application context — each workspace held its own fragments of state (Build had pasted JDs, JD Match had local Match analyses, Letters had vector-derived templates, etc.), and cross-workspace consistency was maintained ad hoc.

This produced concrete problems: duplicate JD analysis logic across four workspaces (JD Match, Build, Prep, ad-hoc cover letter), inconsistent contact data flowing through resume defaults instead of identity, no durable record of "what I sent to Acme on April 22," and no clear answer to "where does the variant selector live for generating a resume against a specific job."

The cover letter generator surfaced the issue most acutely: it needed JD analysis, identity contact data, and resume context, but each came from a different (and sometimes wrong) source.

## Decision

**Pipeline owns durable job context. Build owns resume editing. JDAnalysis bridges job context into downstream projections.**

Each pipeline entry becomes the canonical container for everything related to a specific application: JD text, JDAnalysis (by reference), research artifacts, resume references (current draft + apply-time snapshot), cover letter references (current draft + apply-time snapshot), status, history, interview rounds.

Pipeline becomes the canonical launch point for application-context generation. From a pipeline entry, the user can analyze the JD, generate a resume for this job (with vector / customize-vector / on-demand variant selector), generate a cover letter, run research, open prep.

Build no longer initiates application-context generation. The "paste a JD here, generate a tailored resume" flow is retired (see decision-6 for migration mechanics). Build remains the workspace for editing resume content (vectors, presets, identity-aware content) and providing the live PDF preview as the editing-feedback loop.

JD Match remains exploratory: paste a JD, get canonical JDAnalysis against identity, decide whether to promote to a pipeline entry. Letters and Prep launch from Pipeline. Research is a pipeline-entry enrichment service.

## Consequences

- All cross-workspace concerns flow through pipeline entries rather than parallel state in each workspace.
- The diagnostic rule for "where does this feature belong?" becomes: does it require an application context (a specific job)? If yes, Pipeline. If no, Build (or identity, or wherever the non-application-context home is).
- Duplicate JD analysis paths in Build, JD Match, and Prep get consolidated to canonical JDAnalysis (see decision-4).
- Cover letter and resume generation become pipeline-anchored (see decision-5).
- Architecture doc canonicalizes this: `docs/architecture/facet-workspace-topology.md`.
- Active refactor specs implement this: `docs/development/refactors/2026-04-jd-analysis-consolidation.md` and `docs/development/refactors/2026-04-resume-letter-architecture.md`.
- Pipeline entry data model expands to carry resume_id, resume_snapshot_id, cover_letter_id, cover_letter_snapshot_id, jdAnalysisId references.
- Future workspaces that touch application context default to attaching artifacts to pipeline entries rather than holding their own state.
