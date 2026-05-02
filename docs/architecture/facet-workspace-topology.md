# Facet Workspace Topology

This document defines which workspace owns which kind of data and which kind
of action in Facet. It is the canonical reference for "where does this
belong?" questions during feature design and refactoring.

## The Principle

**Pipeline owns durable job context. Build owns resume editing. JDAnalysis
bridges job context into downstream projections.**

Every workspace has a single responsibility. Cross-workspace concerns flow
through canonical entities (most often, the pipeline entry) rather than
through duplicate state in each workspace.

## Workspace Responsibilities

### Pipeline

Owns the durable record of "this job application." Each pipeline entry is
the canonical container for everything related to a specific application:

- Job description text (the JD itself, editable)
- JD analysis (canonical `JDAnalysis` entity, attached by ID)
- Research artifacts (company info, hiring signals, sources)
- Resume references (current draft + immutable apply-time snapshot)
- Cover letter references (current draft + immutable apply-time snapshot)
- Status, timeline, history, interview rounds, debrief notes

Pipeline is also the canonical launch point for application-context
generation. From a pipeline entry, the user can:

- Analyze the JD (creates/updates the entry's `JDAnalysis`)
- Generate a resume for this job (using a vector, a customized vector,
  or fully on-demand)
- Generate a cover letter for this job (anchored to the entry and a
  selected source resume)
- Run research / pipeline investigation
- Open prep for interview rounds

### Build

Owns resume content editing. Specifically:

- Workspace-level resume data (vectors, presets, identity-aware content)
- Component editing (bullets, projects, skills, education)
- Live PDF preview as the editing-feedback loop
- Theme and design tab

Build does **not** initiate application-context generation. The "paste a
JD here, generate a tailored resume" flow has been retired. When the user
needs a resume for a specific job, they launch from Pipeline; that flow
may load the relevant context into Build for editing, but the application
context (JD, JDAnalysis, target company) lives on the pipeline entry, not
in Build's workspace state.

### JD Match

Exploratory matching surface. The user pastes a JD, gets canonical
`JDAnalysis` against their identity, and decides whether to promote the
match to a pipeline entry. JD Match does not run its own analysis logic —
it consumes the canonical analysis service. Promoting to pipeline attaches
the existing analysis to the new entry without recomputation.

### Letters

Cover letter generation surface, launched from Pipeline. Each letter is
anchored to a pipeline entry and pairs with a specific source resume.
Letters consume canonical `JDAnalysis` for context; they do not run their
own JD analysis.

### Prep

Interview prep generation. Currently has its own per-deck JD analysis
embedded in the prep generator; migration to canonical `JDAnalysis` is
deferred. Prep continues to consume the JD text and identity directly
until that migration lands.

### Research

Pipeline-entry enrichment service. Fetches company info, hiring signals,
research sources. Writes results back to the pipeline entry. Research is
distinct from `JDAnalysis` — research is target-company information;
analysis is candidate-vs-JD matching.

## Generation Variant Model

When the user generates a resume from a pipeline entry, they choose
between three variant origins (see `Resume.origin.type` in the resume
entity model):

- **`vector`** — use an existing general-purpose vector (e.g., "Backend
  Engineering") as-is. No customization for this specific job.
- **`ephemeral_vector`** — start from an existing vector and customize
  it for this job. Produces a new resume entity, derived from a vector
  but tailored.
- **`dynamic`** — fully on-demand generation, not derived from any
  general-purpose vector. Tailored exclusively to this job.

The variant selector lives on the pipeline entry's resume-generation
flow. Build does not surface this selector independently — it's an
application-context decision.

## What This Means for Feature Decisions

When adding a new feature, ask: does this require an application context
(a specific job)? If yes, it belongs in Pipeline (or launches from
Pipeline). If no, it belongs in Build (or in identity, or wherever the
non-application-context home is).

When adding a new analysis or generation pass, ask: does the canonical
`JDAnalysis` already cover what I need? If yes, consume it. If no, extend
the canonical schema rather than building a parallel analysis path.

When adding a new artifact type that's tied to a specific job (resume
variant, letter draft, prep deck), make it pipeline-attached with
snapshot mechanism for apply-time immutability.

## Related Documents

- `docs/architecture/identity-canonical-data.md` — when to mirror identity
  data vs. when per-artifact editorial fields are legitimate
- `docs/development/refactor-process.md` — audit-first pattern for
  cross-cutting changes
- `docs/development/refactors/2026-04-jd-analysis-consolidation.md` —
  active refactor consolidating JD analysis across workspaces
- `docs/development/refactors/2026-04-resume-letter-architecture.md` —
  active refactor making resumes and letters first-class entities
