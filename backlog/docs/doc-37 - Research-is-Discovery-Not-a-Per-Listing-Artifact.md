---
id: doc-37
title: Research is Discovery, Not a Per-Listing Artifact
type: architecture
created_date: '2026-05-04 00:30'
status: Architectural commitment / draft for ADR (clarifies scope of canonical-projections principle from doc-36)
relates_to:
  - decision-2 (Pipeline owns durable job context)
  - decision-3 (Identity is canonical for candidate-only data)
  - doc-24 (Search Workspace Redesign — Search Thesis, Semantic Depth, Feedback Loop)
  - doc-34 (Search Parameters Surface — Hard Constraints + Per-Search Filter Toggles)
  - doc-36 (Per-Listing Artifacts as Projections of Canonical JDAnalysis)
  - task-165 (Fix conditional filter match scoring and propagate conditions)
---

# Research is Discovery, Not a Per-Listing Artifact

## TL;DR

Research workspace is upstream of Pipeline, not a downstream consumer. It produces opportunities; the user triages them; selected opportunities graduate to Pipeline entries. Research does **not** read from canonical JDAnalysis or pipeline entries. The canonical-projections principle from doc-36 applies only to per-listing artifacts (Match, Build, Prep, Letters, etc.), not to Research.

What Research *does* read from canonically is Identity — search criteria, vectors, constraints, preferences. This is a separate canonical-projections relationship from the per-listing one.

## Why this document exists

Doc-36 establishes that per-listing artifacts read from canonical JDAnalysis as projections. That principle is correct for everything Pipeline-anchored (Match reports, Build resumes, Prep decks, Letters cover letters, future per-listing surfaces). It does not apply to Research.

This was implicit but not stated. The result was confusion: when reviewing the Research workspace's current state during a 2026-05-03 architectural conversation, the question came up "should Research consume canonical JDAnalysis like other artifacts?" The answer is no, but explaining *why* required distinguishing Research's architectural role from per-listing artifacts. This document captures that distinction so it doesn't have to be re-derived.

## Data flow

```
Identity (search criteria, vectors, preferences, constraints)
    ↓ feeds discovery engine
Research (discovery service)
    ↓ produces opportunity candidates
User triages → promotes selected to Pipeline
    ↓ creates Pipeline entry pre-populated with discovery data
Pipeline entry exists
    ↓ user can run second-pass investigation
JD surfaces (or already present)
    ↓ JDAnalysis can be run
JDAnalysis canonical entity exists
    ↓ unlocks downstream per-listing artifacts
Build (resumes), Prep (interview prep), Letters (cover letters)
```

Research is upstream of the per-listing artifact class. The hand-off mechanism is **promotion to Pipeline** — once an opportunity becomes a Pipeline entry, downstream artifacts take over. Research does not track promoted opportunities; the thread is cut at promotion.

## What Research consumes canonically

Research reads from Identity. This is a distinct canonical-projections relationship from doc-36's per-listing-from-JDAnalysis pattern.

**Identity owns (canonical for search):**
- Search vectors with thesis, keywords, target roles (per doc-24)
- Search criteria — must-haves, deal-breakers, prioritize/avoid lists with conditions (per doc-34, TASK-150 shipped)
- Skill positioning and depth (per b27f5c9)
- Preferences — compensation, location, remote/hybrid/on-site, employment type (per doc-34)
- Master prioritize/avoid lists with conditional filters (per TASK-150, propagation in TASK-165)

**Research's projection-specific work:**
- Discovery engine execution (calling job board APIs, scraping, etc.)
- Per-search overrides via `SearchInstanceOverrides` (do not pollute identity, per doc-34)
- Results display and triage UI
- Opportunity-to-Pipeline-entry promotion

**SearchProfile is the snapshot mechanism** (per doc-34): identity preferences denormalized at search time, plus search-specific overrides. This preserves reproducibility (`SearchRun.identityVersion`) when underlying identity changes.

This mirrors the per-listing artifact pattern but with Identity as the canonical source instead of JDAnalysis.

## Two distinct uses of "Identity is canonical"

Decision-3 establishes Identity as canonical for candidate-only data. That principle has two specific applications:

1. **Identity-canonical-data principle** (per `docs/architecture/identity-canonical-data.md`): Fields whose value depends only on the candidate (not artifact context) live in Identity. Mirror fields elsewhere read from Identity at normalization time. Editorial fields stay at the artifact. This is about fields *within* a per-listing artifact.

2. **Search-criteria-canonical-to-Identity** (per doc-24, doc-34, this document): Search parameters live in Identity because they're durable candidate attributes, not opportunity-specific configuration. Research reads them via SearchProfile snapshot.

These are related but distinct. The first is "don't duplicate identity-canonical fields inside an artifact." The second is "don't duplicate identity-canonical data across workspaces." Both fall under decision-3's umbrella; both have the same fix shape (canonical store, projections at consumption).

## Why the canonical-projections principle from doc-36 does NOT apply to Research

Doc-36's principle states: every per-listing artifact reads from canonical JDAnalysis. Research is not a per-listing artifact, by three diagnostics:

1. **Research predates a JD existing for any specific opportunity.** Discovery happens before JDs are scraped or pasted; the JD comes with the opportunity, not before it.
2. **Research predates an opportunity being a Pipeline entry.** Pipeline entries exist only after promotion; Research operates on un-promoted opportunity candidates.
3. **Research's outputs (opportunities) are inputs to the per-listing class.** The per-listing class exists *because of* what Research produces. A class cannot consume its own ancestors as canonical.

Stated as a diagnostic rule: **the canonical-projections principle from doc-36 applies to surfaces that produce content about a specific JD-anchored opportunity. Research produces opportunities; it does not produce content about them.**

## What this means for the Research workspace redesign

The legacy ResearchPage thesis form is the artifact of pre-migration state. It contains search-criteria fields that should live in Identity (some already migrated per b27f5c9; more queued per TASK-165). The redesign sequence implied by this principle:

1. **Continue the search-criteria migration to Identity** as scoped in existing tasks (TASK-165, downstream propagation work). Out of scope of this document.

2. **Audit which fields in the legacy ResearchPage thesis form remain.** Some are search-execution context (per-search overrides, search history flags) that legitimately don't live in Identity. Some are Identity-canonical data still duplicated. Map them.

3. **Move Identity-canonical fields out of ResearchPage entirely.** They should be edited in the Identity workspace (likely extending SearchStrategyBand and related identity surfaces). Research workspace stops being an editor for durable search criteria.

4. **Redefine Research workspace as results-display + triage only.** Inputs come from Identity (via SearchProfile snapshot). Outputs are opportunity candidates. UI is opportunities list + per-opportunity actions (promote to Pipeline, dismiss, save) + per-search overrides (filter toggles only, not master-list editing).

5. **The "thesis" concept itself becomes Identity-canonical.** Search vectors with theses already live in Identity (per doc-24). The legacy form's "strategy section" is duplicating them. Retiring the form removes the duplication.

This is not new architecture. It's the completion of a migration already in progress (TASK-150 shipped, TASK-165 queued, milestones m-23 through m-26 tracking the work). What's new in this document is the explicit framing of Research's architectural class — discovery service, not per-listing artifact — which informs how the migration completes.

## Open questions

These are not blocking commitments; they are areas where Research's architectural shape needs further design work.

1. **Per-search overrides scope.** Doc-34's `SearchInstanceOverrides` lets users toggle filters for one search without polluting identity. What's the full set of legitimate per-search overrides vs. things that should always come from identity? Worth being explicit so users don't bypass identity by treating overrides as a back door.

2. **Search history retention.** Each search produces a SearchRun with an `identityVersion`. How long are SearchRun records kept? Are they tied to opportunity promotions (kept while any promoted opportunity exists in Pipeline) or independently retained? Affects storage and reproducibility guarantees.

3. **Cross-workspace search-criteria editing UX.** If search criteria live in Identity, users configure searches by editing their identity. That's architecturally clean but UX-awkward — "I want to do a quick exploratory search in healthcare adtech" shouldn't require editing identity. Per-search overrides solve this for filters; do they solve it for vectors and theses? Probably not — vectors and theses are durable. But the UX needs to be clear about which.

4. **Promotion semantics for partial discovery data.** If Research found a JD URL but couldn't scrape it, what does the Pipeline entry look like at promotion? Pre-populated with everything except JD text? Marked as "needs JD"? Affects the second-pass investigation path mentioned in this document's data flow.

These are out of scope for this document. They belong in implementation specs when the Research workspace redesign starts in earnest.

## Suggested next steps

This document does not file new tasks. It captures the architectural framing so existing work (TASK-165, milestones m-23 through m-26, eventual ResearchPage retirement) lands consistently with doc-36's per-listing canonical-projections principle.

When the Research workspace redesign work resumes, the implementing agent should:
1. Read this document, doc-24, doc-34, and doc-36 together
2. Map remaining Identity-canonical duplication in legacy ResearchPage
3. Coordinate with active SearchStrategyBand and identity-side search surfaces so migration targets exist before sources retire
4. File implementation tasks with explicit reference to this document

Until then, this document serves as the architectural commitment that distinguishes Research from per-listing artifacts and ties the search-criteria-canonical work to the broader canonical-projections frame.

## Related Documents

- `docs/architecture/facet-workspace-topology.md` — workspace topology (note: this doc currently describes Research as "pipeline-entry enrichment service," which is misleading; correction pending)
- `docs/architecture/identity-canonical-data.md` — identity-canonical principle for per-listing artifact fields
- `backlog/decisions/decision-2` — Pipeline owns durable job context
- `backlog/decisions/decision-3` — Identity is canonical for candidate-only data
- `backlog/docs/doc-24` — Search Workspace Redesign (foundation doc, 966 lines)
- `backlog/docs/doc-34` — Search Parameters Surface (242 lines, schema details)
- `backlog/docs/doc-36` — Per-Listing Artifacts as Projections of Canonical JDAnalysis
- `backlog/tasks/task-150` — Identity-side condition field (shipped)
- `backlog/tasks/task-165` — Propagate conditions through SearchProfileFilters (queued)
- `backlog/milestones/m-23` through `m-26` — Search redesign milestone series
