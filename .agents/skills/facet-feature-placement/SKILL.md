---
name: facet-feature-placement
description: "Use at the start of any new feature, refactor, or scoping question — when deciding which workspace owns a feature, where new data should live, how AI inference vs user input should split, or which scope (identity, workspace people index, pipeline entry, prep deck) a piece of state belongs to. Covers the Search → Pipeline → Prep flow with the explicit pipeline-depth criterion (investigation + outcome-touching = pipeline; meta-commentary = neither), the three critical models with their boundaries, prep carry-over scopes (within-process, across-process, people-scoped), the AI-inference-vs-user-input rule, and the resume-LinkedIn-cover-letter-as-derived principle. Triggers: where should this go, where does X live, new feature, scope, scoping, workspace, route, place, placement, identity vs pipeline, identity vs workspace, dashboard, analytics, funnel, conversion, recruiter, calendar, rounds, prep readiness, carry-over, derive, derived, infer, inference, who owns this."
metadata:
  author: facet
  version: "1.0.0"
---

# Facet Feature Placement

Most "where should this go?" questions in Facet collapse to a few decision rules. This skill is the rulebook — when triggered, work through the questions in order before writing code.

Architectural prose lives in `docs/architecture/facet-workspace-topology.md` and `backlog/docs/doc-37` (research-as-discovery). This skill is the **fast decision tree** that points at those docs when the answer needs more depth.

## Decision tree

For any new feature, walk these questions top to bottom. The first definitive answer wins.

### 1. Is the feature meta-commentary about Facet itself?

Examples: usage analytics, conversion funnels, retention dashboards, "how many resumes did I ship this week," vector-effectiveness charts, application volume over time.

**If yes:** the feature does **not** belong in Pipeline, Build, Research, or Prep. Meta-commentary is a separate concern; designate a meta surface (e.g., `/insights`, `/account/activity`) or defer the feature entirely. Do not graft it onto a workspace as a side panel — that bloats the workspace's responsibility and dilutes its mental model.

This is the most-violated rule. Resist the pull to "add a stats card to the pipeline page" — almost every time, the right answer is "this is a different surface."

### 2. Does the feature require an application context (a specific job)?

If the user can only do this thing in the context of *this specific job application*, it belongs in **Pipeline**, or launches *from* a Pipeline entry. Examples:

- JD analysis (canonical entity attached to the entry)
- Prep deck generation for a specific interview round
- Cover letter for this specific job
- Research artifacts about the target company
- Resume variant tailored for this listing
- Interview rounds, scheduling, debriefs

**Pipeline depth** legitimately includes:
- **Investigation:** T1/T2/T3 research, JD analysis, target-company info
- **Outcome-touching workflow:** rounds as first-class, calendar view, prep-readiness, debrief

**Pipeline depth excludes:**
- Meta-commentary (see #1)
- Discovery (see #3)

If yes → Pipeline. Move on.

### 3. Is the feature part of upstream discovery?

Per `backlog/docs/doc-37` (2026-05-04, supersedes earlier framing): **Research is discovery; Pipeline is enrichment.**

Discovery features:
- Recruiter outreach triage (cards in `/recruiter`)
- Search runs and results review
- Opportunity scoring against vectors
- Promoting a search result or recruiter card to a Pipeline entry

These belong in **Research** / **Recruiter** / **Search**, not Pipeline. The promotion action is the boundary — once an opportunity becomes a Pipeline entry, the user has committed to pursuing it, and enrichment takes over.

### 4. Is the feature about the candidate, not any specific job?

Candidate-only features belong in **Identity**:
- Roles, projects, skills, education, certifications, target lines, profile statements
- The Self Model arc (positioning, narrative — see facet-architecture-guard for evidence-vs-narrative)
- Variables (e.g., name, email, links)

If the feature is "edit something true about me regardless of which job," it's identity. Per the identity-canonical-data rule, artifacts mirror identity by reference rather than re-derive.

### 5. Is the feature pure resume editing?

If yes → **Build**. Build owns the editing experience: vector selection, presets, manual overrides, bullet ordering, theme. Build does **not** initiate application-context generation; the "paste a JD into Build" flow is retired. Build receives editing context; it doesn't originate it.

## The three critical models

Facet has three durable models that own state. Other surfaces are either editors of these or derived from them.

| Model | Lives in | Owns | Examples of what's NOT here |
|-------|----------|------|------------------------------|
| **Identity** | `identityStore` | The candidate as a person — roles, projects, skills, narrative arc | Per-job priorities (those are vector classifications, not identity) |
| **Workspace people index** | (the people graph across pipeline, recruiter, debrief) | Identifying info about humans (recruiters, hiring managers, interviewers) — names, roles, contact, history | Per-application interaction notes (those go on the pipeline entry) |
| **Pipeline entry** | `pipelineStore` | Everything about *this specific application* | Candidate-only data (lives in identity) |

**Note on the workspace people index:** as of 2026-05, there is no dedicated `peopleStore.ts` in `src/store/`. Per-person data currently lives scattered across `pipelineStore` (interviewers, hiring managers on rounds), `recruiterStore` (recruiter cards), and `debriefStore` (debrief participants). When a new feature wants to operate on people *across* applications (e.g., "this recruiter's responsiveness," "every interviewer I've ever spoken to at Acme"), you are introducing the people index, not slotting into one. Surface that explicitly in the design rather than duplicating per-person state into yet another workspace.

**Resume, LinkedIn drafts, cover letters, prep decks, debriefs are derived.** They project identity + pipeline-entry state through a vector or context. New "which version of the resume to show" features belong in the projection layer, not in identity.

## Prep carry-over scopes

When prep state needs to persist or be reused across sessions, it splits by scope:

- **Within-process** — applies to one specific application, one round, one deck. Lives on the pipeline entry's prep deck.
- **Across-process** — applies across multiple applications (e.g., "stories I tell in behavioral rounds, regardless of company"). Lives in identity or in a shared prep library.
- **People-scoped** — keyed to a specific person across applications (e.g., "this recruiter prefers async updates"). Lives in the workspace people index.

When adding a new prep field, name the scope first. A field with no clear scope home usually belongs in identity (the most general) — but if it's truly per-application, it belongs on the pipeline entry. Don't smear one scope's data across another.

## AI inference vs user input

Per the MEMORY-tracked rule: **wrong confident-AI output is worse than blank fields.**

Use AI for:
- Static, documented context the AI can ground in (company information, JD analysis from the JD text, vector recommendations)
- Suggestions that the user reviews and accepts
- Drafts the user edits

Collect from the user (form input, not AI):
- Transient specifics: interviewer names, panel assignments, scheduled times
- Ground-truth facts only the user knows: status, history, debrief notes
- Anything where a wrong answer is worse than no answer

**The diagnostic question:** "If the AI gets this wrong, does the user notice immediately, or does it ride downstream and corrupt later decisions?" If the latter, do not let AI fill it.

## Common misplacements (corrected)

- **"Add an analytics card to Pipeline"** → No. That's meta-commentary; designate a meta surface or defer.
- **"Let users paste a JD into Build to tailor the resume"** → No. Application context launches from Pipeline. Build receives, doesn't originate.
- **"Auto-derive the Self Model arc from the role list"** → No. Evidence vs. narrative are different layers. See facet-architecture-guard.
- **"Track recruiter notes inside the pipeline entry"** → Partial. Per-application interactions live on the entry; identifying info about the recruiter (name, role, history with the user) lives in the people index.
- **"Run JD analysis a second time inside Letters/Prep"** → No. Consume the canonical `JDAnalysis` attached to the pipeline entry.
- **"Put a search-results dashboard in Pipeline"** → No. Search/Research is upstream discovery; Pipeline is downstream enrichment.

## Decision-time checklist

Before writing code for a new feature, write down (in your head or in the PR description) the answers to:

1. Which workspace? (Pipeline / Build / Identity / Research / Recruiter / Letters / Prep / Debrief / new meta surface)
2. Which model owns the state? (Identity / Workspace people index / Pipeline entry / derived projection)
3. If it produces text, is the source candidate-only (mirror identity) or artifact-context-dependent (editorial with guardrails)?
4. If it asks for input, does the AI know enough to fill it confidently, or must it come from the user?
5. If it's prep-related, what scope is the carry-over?

Numbers 1–2 are placement; 3–5 are correctness. Both must be answered before code lands.

## Related skills and references

- `facet-architecture-guard` — the four architectural commitments this skill operationalizes.
- `facet-persistence-changes` — once you know **where** the data lives, this skill governs **how** it persists.
- `docs/architecture/facet-workspace-topology.md` — full responsibility breakdown per workspace.
- `docs/architecture/identity-canonical-data.md` — the candidate-only-vs-artifact-context diagnostic.
- `backlog/docs/doc-37` — the research-as-discovery / pipeline-as-enrichment framing (2026-05-04).
