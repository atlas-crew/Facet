---
id: adr-0010
title: Workspace navigation taxonomy organized by user journey
date: 2026-05-04
status: accepted
---

## Context

Facet has eleven workspaces (Overview, Identity, Research, Match, Build, Letters, LinkedIn, Recruiter, Pipeline, Prep, Debrief). Without grouping, the nav is a flat list that teaches the user nothing about how the workspaces relate. With the wrong grouping, the nav teaches the wrong mental model.

The original navigation grouped workspaces as **CORE** (Identity, Research, Match, Build), **EXECUTION** (Pipeline, Prep, Debrief), and **OUTPUT** (Letters, LinkedIn, Recruiter). Two problems with that shape:

1. **Build was placed in CORE while Letters, LinkedIn, and Recruiter were in OUTPUT.** Architecturally per doc-36, all four are per-listing artifacts of the same class — they consume canonical JDAnalysis and produce per-opportunity AI-generated content. Putting Build in a different group from the others taught users a false distinction between "resume" and "other communication artifacts."

2. **CORE had nothing core in common with itself.** Identity is genuinely foundational. Research is discovery. Match is analysis. Build is output generation. Calling all four "core" implied parity that does not exist architecturally and does not match user mental models.

## Decision

**Five sections in the sidebar, organized by user journey, with Build moved to APPLY:**

```
  Overview                  (solo, no section label)

  FOUNDATION
    Identity

  ANALYZE
    Research
    Match

  APPLY
    Build
    Letters
    LinkedIn
    Recruiter

  INTERVIEW
    Pipeline
    Prep
    Debrief
```

Group rationale:

- **Overview** sits at the top with no section label. It is not a workspace alongside the others; it is the home view that summarizes activity across all workspaces. Solo placement signals "return here" without requiring a single-item group label that would feel redundant.

- **FOUNDATION** contains Identity alone. Identity is the canonical foundation everything else reads from per decision-3. Calling it foundational is honest about its architectural role and its persistence across job searches.

- **ANALYZE** contains Research and Match. Both are per-opportunity evaluation work — discover opportunities, analyze fit. Match consumes canonical JDAnalysis (per doc-36) and renders the analysis report. Research is upstream of Pipeline (per doc-37) and produces opportunity candidates.

- **APPLY** contains Build, Letters, LinkedIn, and Recruiter. All four produce per-listing AI-generated content. Per doc-36 they are projections of canonical JDAnalysis. Grouping them together teaches users they are the same architectural class.

- **INTERVIEW** contains Pipeline, Prep, and Debrief. The active-opportunity loop — Pipeline tracks rounds and schedules, Prep prepares for rounds, Debrief captures what happened. Per doc-30 these three are temporally and content-related; Debrief feeds the next Prep.

Ordering top-to-bottom matches the user's journey: foundation, then per-opportunity analysis, then per-opportunity outputs, then active-opportunity tracking. New users land top-to-bottom and the labels teach what to do in order. Returning users skip foundation and live mostly in the lower three groups.

## Consequences

**Positive:**

- Build joins the per-listing artifact group it architecturally belongs to. Users no longer learn a false distinction between "resume" and "other communication artifacts."
- CORE is replaced with FOUNDATION, ANALYZE, and APPLY — three honest labels that teach what each group is for.
- Overview sits where users return to home rather than being mixed into a workspace group.
- Navigation reflects doc-36's per-listing artifact architecture, reinforcing the canonical-projections principle visually.
- Pipeline lives with Prep and Debrief where the active-opportunity work happens.

**Trade-offs:**

- Five sections is more visual weight than the previous three. Acceptable because each section has clear user-task framing.
- Pipeline placement in INTERVIEW slightly oversells one phase of Pipeline's role. Pipeline also tracks pre-interview application status and post-final-decision states, but the dominant daily use case (rounds, schedules, interviewer capture per doc-30) is interview-process work. The label optimizes for the sustained use case.
- The internal route name remains `hub` (per @codex commit d510f37) while the user-facing label is `Overview`. Internal/external naming separation is fine but worth documenting so it is not "fixed" by mistake later.

## Implementation notes

The change is purely in the sidebar nav component and any page-title rendering that reads from a route-to-label mapping. No store changes, no schema changes, no route rename required.

When implementing:
- Section labels render as small-caps eyebrows above their group, matching the existing pattern.
- Overview renders without an eyebrow above it — solo placement.
- The route name `hub` stays internal; only the displayed label changes to `Overview`.
- Active-state styling for the selected workspace remains unchanged.
- Mobile/responsive collapsing of the sidebar should preserve the section grouping when expanded.

## Related

- decision-3 (Identity is canonical for candidate-only data) — Identity standing alone in FOUNDATION reflects this commitment.
- doc-36 (Per-Listing Artifacts as Projections of Canonical JDAnalysis) — the architectural argument for grouping Build with Letters, LinkedIn, Recruiter.
- doc-37 (Research is Discovery, Not a Per-Listing Artifact) — Research's placement in ANALYZE rather than APPLY follows from this distinction.
- doc-30 (Pipeline Depth — Rounds, Research Tiers, and the Calendar) — Pipeline grouping with Prep and Debrief reflects the active-opportunity loop architecture.
