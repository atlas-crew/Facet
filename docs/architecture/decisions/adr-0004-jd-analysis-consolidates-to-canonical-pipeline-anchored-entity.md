---
id: adr-0004
title: JD analysis consolidates to canonical pipeline-anchored entity
date: 2026-05-02
status: accepted
---

## Context

JD analysis was found to exist in four places: JD Match (`jobMatch.ts`, the most mature, multi-pass Sonnet), Build (`jdAnalyzer.ts`, single Haiku pass), Interview Prep (embedded in `prepGenerator.ts`'s deck generation), and ad-hoc consumption inside the cover letter generator. Each implementation used different prompts, fields, models, truncation strategies, and persistence approaches.

Consequences: inconsistent outputs across workspaces, multiple LLM calls covering overlapping territory, improvements to one analysis don't propagate to others, every new feature that needs JD context reinvents the analysis pass.

The cover letter generator's pipeline-attachment refactor surfaced this — the letter generator needed JD analysis as input, and forcing it to either run its own pass (perpetuating duplication) or pull from a non-existent canonical source forced the consolidation question.

## Decision

**JD analysis becomes a canonical pipeline-anchored entity (`JDAnalysis`). Consumer workspaces read from this canonical analysis instead of computing their own. Where consumers need additional shape, they compute downstream projections from canonical analysis rather than running independent JD passes.**

Architecture: canonical core + consumer projections.

- Canonical `JDAnalysis` stores the shared analytical truth: requirements extraction, fit scoring, skills alignment, evidence mapping, gaps, vector recommendations, positioning, advantages, watch-outs.
- Consumer projections (BuildProjection, eventual PrepProjection) are computed from canonical analysis at consumption time. Build's resume strategy fields (`bullet_adjustments`, `vector_strategy`, `suggested_target_line`) become BuildProjection.
- Pipeline entries reference JDAnalysis by ID. Drift detection via JD content hash and identity version.
- Analysis creation is explicit-only — no auto-trigger on consumer access. When a consumer needs analysis and one doesn't exist, surface a one-click "Run analysis" prompt.

Migration scope: JD Match and Build migrate during this workstream. Interview Prep migration is deferred (acknowledged technical debt). Cover letter generation gets built on top of canonical JDAnalysis (separate workstream, blocked on this).

Quality bar: meets JD Match's current output (multi-pass Sonnet, comprehensive structured output).

## Consequences

- Workstream 2 (canonical foundation) shipped 2026-04-29 in commits 3e98f87 and a973b37. 102 tests passing across 5 files.
- Workstream 3 (JD Match migration) and Workstream 4 (Build migration retiring `jdAnalyzer.ts`) follow.
- Cover letter refactor unblocks once Workstream 2 lands.
- Build's `jdAnalyzer.ts` retires (see decision-6 for the full Build-side migration).
- Interview Prep continues to function with its own analysis until a follow-up workstream picks it up.
- Spec lives at `docs/development/refactors/2026-04-jd-analysis-consolidation.md`.
- New consumers of JD context default to reading canonical JDAnalysis from pipeline entries rather than running their own pass.
