---
id: adr-0003
title: Identity is canonical for candidate-only data
date: 2026-05-02
status: accepted
---

## Context

LLM generators in Facet (thesis, prep, cover letter, debrief, LinkedIn profile, search profile inference) have a recurring tendency to re-derive identity-canonical data per artifact rather than reading from identity. The April 2026 audit found instances across multiple generators where structured identity fields (skill depth enum, contact info, preferences) were being regenerated as free-text strings or alternative shapes by the LLM.

The cover letter contact bug surfaced one instance (resume-defaults bleeding into letter contact rendering). The thesis depth bug surfaced another (free-text "Expert / 'could write a book'" strings instead of the 8-value enum on identity.skills.*.depth). Audit found four more instances with similar shape, plus several that were correctly mirroring identity by ID.

Without a principle and diagnostic rule, this anti-pattern recurs every time a new generator gets added. Each new generator decides for itself whether to re-derive identity data or read it, and the decisions drift.

## Decision

**Identity is the canonical home for candidate-only data. Artifacts that display or use candidate-only data must mirror identity (read by reference) rather than re-derive it.**

Per-artifact LLM-generated fields are legitimate only when their value genuinely depends on the artifact's context (which job, which interview, which search angle), not solely on the candidate.

The diagnostic rule for any LLM-generated field:

> Does the field's value depend on the artifact context (which job, which interview, which search angle), or only on the candidate?

- Candidate-only → identity-canonical. Mirror by reference, do not re-derive. Drop the field from the LLM's response schema; populate at normalization time from identity.
- Artifact-context-dependent → editorial. The LLM generates per artifact. Constrain with explicit prompt guardrails: cite identity evidence; do not invent new claims about the candidate.
- Grey zone → default to mirroring identity. Reverse if comparative evidence shows per-artifact tailoring is observably better.

Classification categories (Mirror / Reference-by-ID / Editorial / Open) are documented in `docs/architecture/identity-canonical-data.md`. The April 2026 audit catalog using these categories lives in `docs/development/reports/2026-04-llm-identity-anti-pattern-audit.md`.

## Consequences

- New LLM generators must classify their fields against this rule before shipping. Fields that overlap with identity get dropped from the LLM schema and populated from identity at normalization.
- UI for fields classified as Mirror displays them read-only with a "fix in identity" link, so users understand where the canonical value lives.
- Editorial fields get prompt guardrails reaffirming the LLM should reference identity, not invent values.
- The April 2026 audit's actionable items shipped in `b27f5c9` (2026-05-02): `refactor(thesis): mirror identity-canonical fields in skillDepthMap and unfairAdvantages`. Specifically: A1 (skillDepthMap.depth → identity), A2 (unfairAdvantages.depth dropped), D1 (skillDepthMap.context/searchSignal → identity), D3 (interviewStrategy prompt guardrail). C2/C3 are subsumed by D1 since context/searchSignal are no longer LLM-generated. D2 (verify `searchProfileInference` resume-mode is dead code) remains open as task-206. The Mirror-UX items the audit anticipated (SkillDepthInspector becomes read-only with "Edit in Identity" link, hydration-time normalization for legacy theses) were deferred when the Thesis Map UX they presumed as their host was retired per the workspace topology decision (decision-2). The read-only-with-Edit-in-Identity contract still applies — it lives in `docs/architecture/identity-canonical-data.md` and will inherit to whatever skill-display surface lands under the new topology. Status detail: `docs/development/reports/2026-04-llm-identity-anti-pattern-audit.md`.
- Future audits can reuse the catalog format as a template.
- The principle is referenced from CLAUDE.md and AGENTS.md so agents starting cross-cutting work see it before making decisions.

> **Correction note (2026-05-02):** The fourth bullet originally read "*The April 2026 audit's actionable items (A1, A2, C2/C3 guardrails, D1 demotion, D3 guardrail) ship as one focused commit.*" That was aspirational — written when the audit had been decided but no implementation commit had landed. A 2026-05-02 verification confirmed no such commit existed; `b27f5c9` is the commit that realized it. The bullet above replaces the original with a factual record of what shipped, what was subsumed, and what was deferred (and why).
