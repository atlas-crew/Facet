# Identity Canonical Data

This document captures the principle for handling fields that exist in the
identity model versus fields that artifacts (theses, prep decks, cover
letters, resumes, debriefs) generate themselves. It exists because LLM
generators in Facet have a tendency to re-derive identity-canonical data
per artifact, producing parallel storage, drift, and user-visible
inconsistency.

## The Principle

**Identity is the canonical home for candidate-only data. Artifacts that
display or use candidate-only data must mirror identity (read by reference)
rather than re-derive it.**

Per-artifact LLM-generated fields are legitimate only when their value
genuinely depends on the artifact's context (which job, which interview,
which search angle), not solely on the candidate.

## The Diagnostic Rule

For any field an LLM generates inside an artifact, ask:

> Does the field's value depend on the **artifact context** (which job,
> which interview, which search angle), or only on the **candidate**?

- **Candidate-only** → identity-canonical. Mirror by reference, do not
  re-derive. The canonical home is `identity.*`. Drop the field from the
  LLM's response schema; populate it at normalization time from identity.
- **Artifact-context-dependent** → editorial. The LLM generates it per
  artifact. But constrain the LLM with explicit prompt guardrails:
  reference identity values; do not invent new claims about the candidate.
- **Grey zone** — the field is "derived from identity but tailored for
  this artifact." When in doubt, default to mirroring identity. Add
  per-artifact tailoring later if comparative evidence shows the
  per-artifact framing produces observably better output.

## Classification Categories

When auditing or designing an LLM-generating field, classify it as one of:

### A. Mirror

Field is identity-canonical. Read from identity by reference. Do not let
the LLM produce it. Examples:

- `thesisGenerator.skillDepthMap[].depth` — sourced from
  `identity.skills.*.depth` (8-value enum)
- `thesisGenerator.unfairAdvantages[].depth` — same source

UI surfaces these fields as **read-only with a "fix in identity" link**
so users understand where the value lives and how to change it.

### B. Reference by ID

Field references identity entities by ID rather than copying data.
Examples:

- `identityParametersGeneration.search_vectors[].supporting_skills` —
  references identity skill names
- `debriefGenerator.anchorStories[].roleId/bulletId` — references
  identity entity IDs

This is the architecturally-correct pattern. New generators should follow
it when they need to express "this artifact relates to these identity
entities."

### C. Editorial (Stay)

Field is per-artifact context-dependent. The LLM legitimately produces
different values per artifact. Examples:

- `thesisGenerator.narrative`, `competitiveMoat`, `searchLanes` — per-thesis
  search strategy, genuinely tailored per search angle
- `prepGenerator.questionsToAsk`, `donts`, `rules` — per-target-company
  editorial
- `coverLetterGenerator.paragraphs` — per-letter editorial
- `linkedinProfileGenerator.headline`, `about` — per-LinkedIn-draft
  editorial

Editorial fields should still have prompt guardrails: "do not invent new
claims about the candidate; cite identity evidence; frame identity
positioning for this context." This is cheap insurance against future
drift.

### D. Open / Needs Decision

Field's classification is unclear and needs product-level decision.
Surface these explicitly during refactor work; don't ship blindly. Common
shape: "field is currently per-artifact editorial but the value pattern
suggests it might be canonical with per-artifact framing on top."

## Default Behavior for Grey Zone

When unclear whether a field is editorial or canonical, default to
**Mirror**. Reasons:

1. Per-artifact re-invention is the failure mode that produces drift
   the user can't trace back to anywhere they edited.
2. Mirror is reversible — if comparative evidence later shows
   per-artifact tailoring produces observably better output, the field
   can be promoted to editorial with a prompt guardrail.
3. Editorial requires the LLM to make a choice; mirror requires the
   data to be accurate. Mirror is harder to break.

## Workflow When Adding New LLM-Generated Fields

Before shipping a generator that produces a new field that overlaps with
identity:

1. Classify the field (A/B/C/D per above).
2. If A or B: don't add the field to the LLM's response schema. Source
   from identity at normalization time.
3. If C: add prompt guardrails reaffirming "don't invent identity
   values."
4. If D: surface to product/architecture decision before shipping.

## Related Documents

- `docs/architecture/facet-workspace-topology.md` — workspace
  responsibilities and where data lives
- `docs/development/refactor-process.md` — audit-first pattern for
  finding and fixing instances of this anti-pattern
- `docs/development/reports/2026-04-llm-identity-anti-pattern-audit.md` —
  April 2026 audit catalog of generators classified by this rule
