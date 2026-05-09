---
name: facet-architecture-guard
description: "Use when touching identity, pipeline entries, the workspace people index, JD analysis, research, or any LLM generator that produces fields about the candidate. Enforces Facet's four load-bearing architectural commitments: identity-canonical-data (artifacts mirror identity, never re-derive), pipeline-as-canonical (pipeline owns durable job context), evidence-vs-narrative (roles/projects = evidence, identity Self Model = interpretation), and research-as-discovery (research is upstream discovery, pipeline is downstream enrichment). Triggers: identityStore, pipelineStore, jdAnalyzer, prepGenerator, thesisGenerator, coverLetterGenerator, debriefGenerator, linkedinProfileGenerator, recruiterStore, workspace, listing, application, candidate, mirror, canonical, research, discovery, triage."
metadata:
  author: facet
  version: "1.0.0"
---

# Facet Architecture Guard

Facet has four architectural commitments that are easy to violate by accident and expensive to undo. This skill is the trigger surface that loads them into context the moment an agent touches the relevant code.

The full prose lives in `docs/architecture/`. This skill is the **decision-time pocket reference** — read the diagnostic questions here; consult the linked docs for examples and audit history.

## 1. Identity is canonical for candidate-only data

**Diagnostic question, applied to every LLM-generated field:**

> Does this field's value depend on the *artifact context* (which job, which interview, which search angle), or only on the *candidate*?

- **Candidate-only** → identity-canonical (Mirror). Drop the field from the LLM's response schema; populate it at normalization time from `identity.*`. UI shows it read-only with a "fix in identity" link.
- **Artifact-context-dependent** → editorial. The LLM legitimately produces it per artifact, but prompt guardrails must say "do not invent new claims about the candidate; cite identity evidence."
- **References to identity entities** → use IDs (`roleId`, `bulletId`, skill names), not copies. Pattern: `debriefGenerator.anchorStories[].roleId`.
- **Grey zone** → default to Mirror. Mirror is reversible; per-artifact re-invention produces drift the user can't trace.

When unsure, surface the field as Open/Needs Decision rather than shipping. See `docs/architecture/identity-canonical-data.md` for the full A/B/C/D classification and audit examples.

## 2. Pipeline owns durable job context

**Where does this feature live?**

- Requires an application context (a specific job)? → **Pipeline.** Or launches *from* a pipeline entry.
- No application context? → **Build** (resume editing), **Identity** (candidate-only), or **Search/Research** (upstream discovery).
- Needs JD analysis? → consume the canonical `JDAnalysis` entity attached to the pipeline entry. Don't run a parallel analysis.

**The retired pattern (do not reintroduce):** "Paste a JD into Build, generate a tailored resume." Application-context generation launches from Pipeline. Build receives editing context but never originates it.

**Resume variant origins** (`Resume.origin.type`): `vector` (use as-is), `ephemeral_vector` (start from vector, customize for this job), `dynamic` (fully on-demand). The selector lives on the pipeline entry's resume-generation flow.

See `docs/architecture/facet-workspace-topology.md` for the per-workspace responsibility breakdown.

## 3. Evidence vs. narrative — never collapse

Two layers of identity data, not one:

- **Evidence/facts:** `identity.roles[]`, `identity.projects[]`, `identity.skills[]`. Stable, verifiable, change only when the candidate's actual history changes.
- **Narrative/interpretation:** identity Self Model arc, positioning, "why this matters." Authored by the candidate (with LLM assistance), reflects the *story* told about the evidence.

**The failure mode:** auto-deriving narrative from evidence (e.g., generating a Self Model paragraph from the role list at save-time). This collapses the two layers, makes narrative un-editable in practice, and produces output that drifts every time evidence is touched.

If you find yourself writing code that synthesizes narrative fields from evidence fields, stop. Either:
- The narrative is editorial — leave it to the user/LLM authoring flow with prompt guardrails.
- The "narrative" is actually a derived view — name it that way, compute on read, don't persist.

## 4. Research is discovery; pipeline is enrichment

Per `backlog/docs/doc-37` (2026-05-04, supersedes earlier topology framing):

- **Research** = upstream discovery. The user finds opportunities, triages them, promotes candidates to Pipeline. Inputs are open-world (search results, recruiter outreach, network leads); outputs are pipeline-entry candidates.
- **Pipeline** = downstream enrichment. Each entry already represents a committed application. Investigation, JD analysis, prep, debrief, calendar — all enrich an entry the user has decided to pursue.

**Do not put pipeline-depth features into Research.** Investigation, T2/T3 deep research, prep readiness, calendar — these belong on the pipeline entry, not in the discovery surface. Conversely, do not put discovery features into Pipeline (recruiter scrape triage, opportunity scoring against vectors, etc.) — those are upstream.

**Meta-commentary features** (analytics, funnel charts, conversion dashboards) are neither pipeline-depth nor research-depth. They are a separate concern; do not graft them onto either workspace.

## 5. Pre-launch posture

Facet has no live users. Backwards compatibility is not a constraint. When proposing a change:

- Recommend the cleanest end state, not the one with the smallest intermediate gap.
- Don't propose temporary scaffolding, dual-write phases, or revert-safety harnesses unless asked.
- Schema change? Just change it. Storage migration is allowed to break local-only data.

This posture inverts later — keep the rule loaded so habits formed now don't ossify into "we always did it that way."

## When to skip this skill

- Pure UI/CSS/styling work with no domain-data shape changes.
- Test-only changes that don't introduce new generators or new fields.
- Editing existing copy/microcopy/labels.

## Verifying claims

If a subagent or earlier reasoning asserts that a generator already mirrors identity, or that a field is canonical, or that a feature already lives in the right workspace — verify before acting. Run the diagnostic questions above against the actual schema/code, not the asserted summary. See `~/.claude/rules/delegation-verification.md` for the protocol.
