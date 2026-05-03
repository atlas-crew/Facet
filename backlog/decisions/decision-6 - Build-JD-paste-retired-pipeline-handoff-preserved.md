---
id: decision-6
title: Build JD-paste path retired pipeline-handoff preserved
date: '2026-05-02 15:00'
status: accepted
---
## Context

Decision-2 commits to "Pipeline owns durable job context. Build no longer initiates application-context generation." The mechanical question was how to retire Build's existing JD-paste flow without leaving users stranded mid-sequence.

Build currently exposes a "paste a JD here, generate a tailored resume" flow. Pipeline already has a handoff mechanism that hands a JD into Build via `PipelinePage.tsx:138`, where Build consumes it into the JD modal at `BuildPage.tsx:824`. Build also runs its own JD analysis via `jdAnalyzer.ts` (the duplicate that decision-4 retires).

The naive retirement plan ("remove Build's JD modal in commit X, add Pipeline-launched generation in commit Y") would create a UX dead zone between X and Y where users have no path to "generate a resume for a specific job."

## Decision

**Restrict Build's job generation to the pipeline-handoff path. Remove Build's direct JD-paste entry, but preserve the pipeline-to-Build handoff so users launching from a pipeline entry land in Build with the entry's context loaded.**

Specifically:
- Direct "paste a JD into Build to start job generation" entry is removed.
- Pipeline handoff (Pipeline entry → Build with JD/identity/JDAnalysis context) is preserved as a bridge.
- Build no longer runs its own JD analysis. `jdAnalyzer.ts` is retired; Build's resume strategy becomes a BuildProjection computed from canonical JDAnalysis (see decision-4).
- No user loses the "generate a resume for this job" path. They just enter that path through Pipeline.

Once the resume variant selector lands on pipeline entries (Bundle 2 of the refactor), the handoff target evolves: Pipeline shows the variant selector (vector / customize-vector / on-demand), and the selection drives whether Build is opened for editing or generation runs entirely from Pipeline.

## Consequences

- No UX dead zone during the retire-and-replace sequence. The pipeline-handoff path stays operational throughout.
- Build's role contracts to: workspace-level resume editing, vector and preset management, identity-aware content editing, live PDF preview.
- Build has no JD-paste UI, no own JD analysis, no own JD modal.
- Bundle 1 of the Pipeline/Build/Letters refactor delivers this change. Bundle 2 replaces the handoff with the variant selector.
- The agent committing the change names the commit `refactor(build): restrict job generation to pipeline handoff` (not "remove Build application generation entrypoints" — the latter framing produced the dead-zone risk).
- Existing Build-side pasted-JD state is discarded, not migrated. The state was component-local and transient; the durable replacement is pipeline-attached JD text plus canonical JDAnalysis.
