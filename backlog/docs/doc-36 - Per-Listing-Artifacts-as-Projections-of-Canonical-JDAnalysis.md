---
id: doc-36
title: Per-Listing Artifacts as Projections of Canonical JDAnalysis
type: architecture
created_date: '2026-05-03 22:35'
updated_date: '2026-05-03 23:10'
status: Architectural commitment / draft for ADR (data shapes confirmed in live output 2026-05-03)
relates_to:
  - decision-2 (Pipeline owns durable job context)
  - decision-3 (Identity is canonical for candidate-only data)
  - decision-4 (JD analysis consolidates to canonical pipeline-anchored entity)
  - decision-5 (Resumes and letters are first-class entities)
  - doc-25 (Prep Workspace Gap Analysis)
  - doc-28 (Prep Workspace Structural Additions)
  - doc-30 (Pipeline Depth — Rounds, Research Tiers, and the Calendar)
  - task-208 (Refactor Prep workspace to consume canonical JDAnalysis)
---

# Per-Listing Artifacts as Projections of Canonical JDAnalysis

## TL;DR

Every per-listing artifact Facet produces — Match reports, Build resumes, Prep decks, Letters cover letters, LinkedIn cards, recruiter cards, future formats — should read from canonical JDAnalysis on the linked pipeline entry. Artifact-specific transformation is the projection. No artifact re-derives its own interpretation of the JD.

This is the canonical-core-plus-projections principle, generalized beyond the original JD analysis consolidation.

## Context

The JD analysis consolidation refactor (decision-4) fixed four duplicate JD analysis paths across Match, Build, Prep, and Letters. That refactor framed the canonical-plus-projections pattern as a fix for a specific anti-pattern: workspace-by-workspace development without architectural commitments accumulating duplicate inference.

Empirical observation while reviewing a real Match-workspace JDAnalysis output for a Senior Platform Engineer role surfaced a sharper claim: the canonical JDAnalysis output is rich enough to **drive** downstream artifacts, not just inform them. Specifically, Prep generation currently re-infers content (skill positioning, gap framings, predicted questions, advantages) that is already present in the canonical analysis. The same shape applies to Build (vector-based targeting could read from JDAnalysis matched vectors), Letters (Workstream 3 already moves in this direction), LinkedIn outreach, recruiter cards, and any future per-listing surface.

This document stakes the claim that the canonical-plus-projections pattern is not a one-off fix for JD analysis duplication. It is the architectural shape Facet should commit to for all per-listing artifacts.

## The Principle

> JDAnalysis is the canonical interpretive layer between raw JD and any per-listing artifact. Each artifact reads from JDAnalysis and applies an artifact-specific projection. No artifact re-derives interpretive content (skill positioning, fit analysis, gap framing, advantages, watchOuts, recommendations).

### What this means concretely

**Canonical JDAnalysis owns:**

- Stable identity: `id`, `pipelineEntryId`, `jdTextHash`, `modelVersion`, `generatedAt`, `updatedAt`, `identityVersion`
- Matched vectors with thesis fit explanations and per-vector evidence
- Skill matches with `userDepth`, `requirementStrength`, `matchQuality`, `presentationGuidance`, `userPositioning`
- `strengthsToLead`, `triggeredPrioritize`, `triggeredAvoid`, `relevantAwareness`
- Requirements decomposition with `coverageScore`, `keywords`, `tags`, `matchedAssetCount` per requirement
- `advantageHypotheses` (claims) and `advantages` (claims with grounded evidence chains) — see two-stage pattern below
- Gaps with severity, reason, and `gapFocus` framings
- `evidenceMapping` — `topBullets`, `topSkills`, `topProjects`, `topProfiles`, `topPhilosophy` with scores, matched tags, and matched requirement IDs per item
- Positioning recommendations
- Warnings (role-specific cautions)
- `requirementCoverageScore` — scalar summarizing JD coverage by identity

**Artifacts add the layer the analysis doesn't produce:**

| Artifact | Projection-specific work | Reads from JDAnalysis |
|---|---|---|
| **Match report** | Renders the analysis directly with progressive disclosure | All of it (this is the canonical surface) |
| **Build (resume generation)** | Selects bullets, applies vector targeting, formats output | `matchedVectors`, `skillMatches`, `strengthsToLead`, `evidenceMapping.topBullets` filtered by `matchedRequirementIds` |
| **Prep (interview prep deck)** | Drafts rehearsable scripts, anchor stories, meta-coaching, drilling cards | All interpretive fields; `evidenceMapping` for story selection by requirement; Prep adds script drafting + meta-coaching |
| **Letters (cover letter)** | Drafts paragraph-level prose anchored to specific evidence | `matchedVectors`, `advantages` with grounded evidence chains, `skillMatches` |
| **LinkedIn outreach** | Crafts messages anchored to JD-specific hooks | `advantages` claims, `triggeredPrioritize` |
| **Recruiter card** | Headline + 3 bullets in card format | `advantages` claims, `strengthsToLead` |

The diagonal — what's "projection-specific" — is what each workspace genuinely contributes. The horizontal — interpretive content about the JD — is shared and canonical.

### Diagnostic rule for new artifacts

When considering whether a new per-listing artifact (or a new field on an existing artifact) should re-derive content or read from canonical JDAnalysis, ask:

> Is the content interpretive (about the JD's meaning, the candidate's fit, the strategy) or transformational (about how to format, present, or deliver)?

- **Interpretive** → read from JDAnalysis. Never re-derive.
- **Transformational** → artifact-specific projection. Owned by the artifact.

If the field's value would change based on the JD's content, it is interpretive and lives in JDAnalysis. If the field's value would change based on the artifact's format, audience, or delivery context, it is transformational and lives in the artifact.

## Why This Matters

### The failure mode this prevents

The original JD analysis duplication produced four parallel implementations because each workspace was built sequentially without an architectural principle holding the line. Each implementation was locally rational. Globally, they drifted: skill positioning in Match conflicted with skill positioning in Prep; gap framings in Letters did not match gap framings in Build; users saw inconsistent narratives across artifacts produced from the same JD.

The fix was canonical JDAnalysis. But the fix was framed as a narrow refactor. Without an explicit principle, the same anti-pattern recurs every time a new artifact is added: LinkedIn outreach re-derives. Recruiter cards re-derive. Future surfaces re-derive. Each addition seems locally rational; the cumulative effect is drift.

This principle says: the next agent or contributor adding a per-listing artifact should read from JDAnalysis as the default. Not as an option. Not as a refactor opportunity later. As the architectural shape.

### The downstream improvements this enables

- **Internal consistency.** Every artifact for a given pipeline entry tells the same story, because they read from the same canonical interpretation.
- **Single source of truth for updates.** Re-analyzing the JD updates every artifact downstream, not just the one being viewed.
- **Composability.** New artifacts (PDF cheat sheets, audio briefings, mobile cards) compose on the analysis without re-implementing the interpretive layer.
- **Cost savings.** One analysis call per JD, not N artifacts × N analyses.
- **Audit trail.** Every artifact references the JDAnalysis ID; users can see exactly which analysis a given artifact was generated from.

## Existing Architectural Commitments This Builds On

This document does not introduce new patterns. It generalizes existing commitments:

**decision-2** establishes Pipeline as the canonical container for one application. JDAnalysis lives on the pipeline entry. This document affirms that artifacts launched from a pipeline entry read from that entry's canonical analysis.

**decision-4** establishes JD analysis as a canonical pipeline-anchored entity. This document extends that commitment by stating *every* per-listing artifact follows the same read-from-canonical pattern, not just the original four (Match, Build, Prep, Letters).

**decision-5** establishes resumes and letters as first-class entities with snapshot mechanisms. This document affirms that the interpretive content of those entities (which JD they were generated against, what advantages were claimed, what skills were positioned) traces back to a specific JDAnalysis snapshot at apply-time.

The diagnostic rule from `docs/architecture/identity-canonical-data.md` ("Does the field's value depend on artifact context, or only on the candidate?") has a JD-side analog here: "Does the field's value depend on the JD's content, or on how the artifact presents it?"

## Concrete Data Shapes (Observed in Production)

The principle above was specced before the canonical JDAnalysis entity was fully populated in production output. A subsequent Match-workspace run (2026-05-03, model `jd-analysis.v1.match-multipass-sonnet`) shipped the canonical entity as a top-level field with the following structural commitments worth documenting explicitly. These are not new claims — they are concrete grounding for the abstract principle.

### Persistence anchor

Live JDAnalysis output carries the fields needed to be a real first-class entity, not a transient computation:

```
id: string
pipelineEntryId: string
jdTextHash: string              // hash of the JD text used to generate
modelVersion: string            // 'jd-analysis.v1.match-multipass-sonnet'
generatedAt: ISO8601
updatedAt: ISO8601
identityVersion: int            // identity model version at generation time
```

This is what makes "snapshot the JDAnalysis a downstream artifact was generated from" implementable per decision-5. Any Prep deck, resume snapshot, or letter snapshot can reference `jdAnalysisId` and the consumer can verify both the JD it was generated against (`jdTextHash`) and the identity state at generation time (`identityVersion`).

### Two-stage hypothesize-then-ground pattern

The live output separates `advantageHypotheses` from `advantages`:

- `advantageHypotheses[]` — LLM-generated claims with `id`, `claim`, `requirementIds`. These are the hypothesis-stage output: "the candidate has advantage X because of requirements Y and Z."
- `advantages[]` — same claims with grounded evidence chains attached. Each advantage carries an `evidence[]` array where each evidence item has `kind` (bullet/skill/profile/project/philosophy), `score`, `matchedTags`, `matchedRequirementIds`, and the source content.

This separation matters for two reasons:

1. **Trustworthiness through traceability.** A claim is verifiable by inspecting its evidence chain. The model produces the hypothesis; deterministic matching attaches the supporting identity content. If the evidence chain is empty or weak, the hypothesis is suspect.
2. **Repeatable composition for downstream artifacts.** A Prep deck card claiming "lead with this advantage" can show the user *which* identity content (which bullet, which skill, which philosophy excerpt) supports it. Letters can anchor a paragraph to specific evidence items by reference. The grounding is structured, not narrated.

This pattern likely generalizes beyond advantages. Any artifact that generates claims should consider the same two-stage shape: hypothesize, then ground. Prep generation specifically is a candidate — talking points as hypotheses, identity evidence attached deterministically.

### Evidence mapping as the explicit projection source

`evidenceMapping` is the data shape that downstream artifacts read from when they need grounded identity content tied to JD requirements:

```
evidenceMapping: {
  topBullets: EvidenceItem[]
  topSkills: EvidenceItem[]
  topProjects: EvidenceItem[]
  topProfiles: EvidenceItem[]
  topPhilosophy: EvidenceItem[]
}

EvidenceItem: {
  id: string
  kind: 'bullet' | 'skill' | 'project' | 'profile' | 'philosophy'
  label: string
  sourceLabel: string           // e.g., "ThreatX (acquired by A10 Networks)"
  text: string                  // full content
  tags: string[]
  matchedTags: string[]         // tags that matched JD requirements
  matchedKeywords: string[]
  matchedRequirementIds: string[]  // which JD requirements this evidence supports
  score: float                  // grounding strength
}
```

Downstream artifacts read this directly rather than re-running their own grounding pass. Examples:

- **Build's resume generation** filters `topBullets` by `matchedRequirementIds` to identify which existing identity bullets are the strongest candidates for this JD, then applies vector targeting to that filtered set.
- **Prep's anchor story selection** filters `topBullets` and `topProjects` by requirement to identify which stories carry the most grounded evidence for predicted hard questions.
- **Letters' paragraph anchoring** reads `topBullets` ordered by `score` to identify the strongest single piece of evidence per paragraph.

This is the structured backbone the projection table in "What this means concretely" depends on. Without `evidenceMapping`, each artifact would need to re-compute identity-to-requirement mapping. With it, mapping is canonical and artifacts compose on it.

### Requirement decomposition

`requirements[]` decomposes the JD into individually-tracked items:

```
requirements: [
  {
    id: 'req-1',
    label: 'CI/CD Pipeline Design & GitLab Expertise',
    priority: 'core' | 'important' | 'nice-to-have',
    evidence: string,             // JD excerpt supporting this requirement
    tags: string[],
    keywords: string[],
    coverageScore: float,         // how well user's identity covers this
    matchedAssetCount: int,
    matchedTags: string[]
  },
  ...
]
requirementCoverageScore: float   // aggregate scalar
```

This is what makes per-requirement framings possible. A gap framing for `req-7` (Cross-Functional Collaboration) reads the requirement's evidence and the gap-focus framing for that specific requirement, not a generic gap statement. A skill alignment table reads requirements alongside `skillMatches` to render the full "their stack vs. your match" grid.

### What this confirms about the principle

The original document framed canonical-plus-projections as the right architectural shape. The live output confirms it is the shipping shape. The data shapes above mean:

- Downstream artifact refactors (Letters consuming canonical `jdAnalysis` before Workstream 4, in flight as of 2026-05-03; task-208 for Prep, queued; similar work eventually for Build's vector targeting) can be specified concretely against the actual `evidenceMapping` and `requirements[]` structures, not against a hypothetical schema.
- The `jdAnalysisId + jdTextHash + identityVersion` triple makes drift detection implementable as a comparison, not a heuristic. An artifact's stored `jdAnalysisId` either matches the current pipeline-entry analysis or doesn't.
- The hypothesize-then-ground pattern is a real pattern in production code, not a future ambition. New generation features (prep generation, letter generation, future formats) should be checked against this pattern: are claims hypothesized first and grounded second, or are they generated as a single pass that bundles hypothesis and grounding together?

### `analysis` vs `jdAnalysis`: adapter boundary, not a new source of truth

The live Match-report payload carries both an `analysis` section and a `jdAnalysis` section with mostly-overlapping fields. This duplication is intentional and is the correct architectural shape during the transition. Specifically:

- **`analysis`** is the per-report/projection payload that existing Match UI already knows how to render. It is the legacy view contract.
- **`jdAnalysis`** is the canonical persisted artifact and handoff source for Pipeline-owned job context. It is the entity downstream artifacts read from.

The duplication is an adapter boundary, not a new source of truth. New code must not treat `analysis` as a parallel canonical entity. The rule:

> **New downstream application artifacts (Prep, Build, Letters, LinkedIn, future formats) consume `jdAnalysis`. Old UI/report surfaces may keep reading `analysis` until migrated.**

This is a deliberate seam, not technical debt. It allows the Match workspace UI to keep rendering against its existing contract while new features build against canonical persistence. The seam is finite, not permanent: once consumers migrate, the duplication should be cleaned up.

### Cleanup follow-ups (not blocking, file as separate tasks)

The adapter boundary above implies four follow-up cleanup items. None are blocking; they are the work needed to fully retire `analysis` as a parallel surface:

1. **Migrate Match UI to read from `currentJDAnalysis` where possible.** The Match workspace renders most fields that already exist on `jdAnalysis`. Migrating Match UI to the canonical entity is the largest single cleanup item.
2. **Keep `analysis` only for view-specific scoring/projection fields that are not canonical.** Once Match UI reads from `jdAnalysis`, the remaining fields on `analysis` should be classified: either they are projection-only (Match-specific rendering hints, sort orders, UI affordances) and stay on `analysis`, or they duplicate canonical fields and should be removed.
3. **Remove duplicated fields once no consumers need them.** The fields that exist on both `analysis` and `jdAnalysis` and have no Match-specific projection logic should be removed from `analysis` after Match UI migrates.
4. **Add tests that Pipeline handoff, cover letter generation, and resume generation use canonical `jdAnalysis`, not the projection.** Lock the rule with test coverage: any downstream artifact reading from `analysis` instead of `jdAnalysis` should fail a test.

These are tracked separately from task-208 because they are about retiring the adapter boundary, not about the prep refactor itself. File when ready.

## What This Does Not Mean

**This does not mean Prep, Build, or Letters become passive renderers.** Each artifact does substantial work — story selection, script drafting, paragraph composition, vector targeting, format-specific output — that JDAnalysis cannot produce. The principle separates *what* (canonical) from *how* (projection). Both layers are real product.

**This does not mean every artifact must regenerate when JDAnalysis updates.** Drift detection is a UI concern — surface staleness when source JDAnalysis updates, but don't auto-regenerate. Users decide when to refresh.

**This does not mean canonical JDAnalysis must be perfect on first generation.** JDAnalysis can be updated, refined, re-run. Artifacts read from the current version and snapshot the version they were generated against (per decision-5).

**This does not mean per-round prep, per-audience LinkedIn, or per-format outputs cannot diverge.** Round-level overlays, audience-specific tuning, format-specific transformations all happen in the artifact's projection layer. The constraint is only that interpretive content of the JD itself lives in one place.

## Open Architectural Questions

These are not blocking commitments; they are areas where this principle's application needs further design work.

1. **Build's vector-based targeting.** Currently Build's resume generation takes vector priorities as input. JDAnalysis produces matched vectors with priority and matchStrength. Should Build's vector input be derived from JDAnalysis matched vectors automatically, or should it remain user-curated with JDAnalysis as a suggestion source? Answer affects whether Build is fully automated downstream of JDAnalysis or remains a human-in-the-loop projection.

2. **Round-level vs role-level projection layering for Prep.** Per task-208, Prep needs to model both "generic prep for the role" and "per-round overlays." The role-level layer is a clean projection of JDAnalysis. The round-level layer adds per-interviewer intel that JDAnalysis does not produce (because interviewer identity is user-sourced per doc-30). Architectural shape needs explicit design.

3. **Cross-artifact regeneration semantics.** When JDAnalysis updates (e.g., user re-runs analysis after JD edits, or identity model improves), what happens to downstream artifacts? Stale-flag UI is the obvious answer for visible artifacts. What about apply-time snapshots that are immutable? Per decision-5, snapshots stay immutable; current drafts get stale-flagged. Confirm and document.

4. **Generalization beyond per-listing artifacts.** Does this principle apply to per-search artifacts (search runs, search results, recommended companies)? Per-candidate artifacts (resumes generated speculatively, no pipeline entry)? The cleanest framing is that it applies to anything anchored to a JD; speculative resumes generated without a JD do not have this constraint.

## Suggested Path to Adoption

This principle should be promoted to a formal decision ADR (decision-10 or whatever the next number is) once the open questions above are resolved or explicitly deferred. Promoting too early risks staking commitments before the design is clear; deferring indefinitely risks the principle eroding through new feature additions.

Recommended sequence:

1. **Letters consumes canonical `jdAnalysis`** (in flight as of 2026-05-03). Cover letter agent migrating Letters to read from canonical analysis before proceeding to Workstream 4. Locks the canonical-consumption test guardrail (cleanup item #4) for the letters bundle, establishes the pattern subsequent artifacts follow.
2. Land task-208 (Prep refactor) as the next explicit application. Audit can specify concretely against the live `evidenceMapping` and `requirements[]` shapes documented above, not against a hypothetical schema. Prep references the test guardrail Letters establishes rather than re-locking it.
3. Use Prep work to surface and resolve the round-level vs role-level question (#2 in Open Architectural Questions above)
4. Audit Build's current targeting logic to resolve the vector-input question (#1 above). Build should consume `evidenceMapping.topBullets` filtered by `matchedRequirementIds` rather than running its own bullet-to-JD matching pass.
5. Apply the hypothesize-then-ground check to existing generation features (Prep, Letters): are they currently single-pass, or do they separate hypothesis from grounding? If single-pass, consider migrating to the two-stage pattern as a follow-up.
6. Write the formal decision ADR with the principle, the diagnostic rule, the artifact projection table, and the data shapes documented in "Concrete Data Shapes" above.
7. Reference the ADR from CLAUDE.md and AGENTS.md.

Until the formal ADR lands, this document serves as the architectural commitment that future per-listing artifacts and refactors should align with.

## Related Documents

- `docs/architecture/facet-workspace-topology.md` — workspace topology and pipeline ownership
- `docs/architecture/identity-canonical-data.md` — canonical-mirror-editorial classification for identity
- `backlog/decisions/decision-4` — JD analysis canonical entity decision
- `backlog/decisions/decision-5` — Resumes and letters as first-class entities
- `backlog/docs/doc-25` — Prep workspace gap analysis (strategy/meta-coaching layer)
- `backlog/docs/doc-28` — Prep workspace structural additions (interviewer intel, card kinds)
- `backlog/docs/doc-30` — Pipeline depth, rounds, research tiers
- `backlog/tasks/task-208` — Prep refactor to consume canonical JDAnalysis (first explicit application)
