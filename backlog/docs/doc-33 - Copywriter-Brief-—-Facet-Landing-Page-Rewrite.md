---
Status: Reference / brief (delivered — v1 + v2)
Relates to:
  - doc-20 (Data Strategy & Privacy Model) — AGPL trust engine, opt-in aggregate posture
  - doc-25 (Prep Workspace Gap Analysis) — prep-depth motivation
  - doc-28 (Prep Workspace Structural Additions) — intel grids, per-interviewer cards
  - doc-29 (Close-Out Hosted Persistence) — real infrastructure state
  - doc-30 (Pipeline Depth — Rounds, Research Tiers, and the Calendar) — three-tier research, rounds, calendar
Scope: >-
  Copywriter brief for the Facet landing page rewrite at atlascrew.dev/facet.html.
  Defines audience, positioning, differentiators, honesty boundaries, voice, and
  the structural agenda. Covers hero, The Loop, new differentiator section,
  terminal sample replacement, AGPL/trust elevation, and CTA scope. Delivered
  v1 2026-04-23 (copy-only); v2 update 2026-04-23 corrected category-creation
  framing (dropped ChatGPT-as-competitor), renamed "Why this" to "What Facet
  replaces," and restructured The Loop so Build / Letters render as a smaller
  derived-outputs row below the primary three-step flow.
id: doc-33
title: 'Copywriter Brief — Facet Landing Page Rewrite'
type: other
created_date: '2026-04-23 17:00'
---

# Copywriter Brief — Facet Landing Page Rewrite

## Delivered (2026-04-23)

Executed copy-only pass on `atlascrew.dev/facet.html`:

- **Title / meta / OG / Twitter** — replaced "AI-Powered Career Platform" positioning with "Identity-driven workspace for serious interview prep"; description rewritten to lead with identity model + per-person research.
- **Hero body** — replaced abstract "deep model of who you are" framing with concrete "structured library of roles, accomplishments, and anchor stories"; introduced the opinionated "You supply the names on your panel" line; trust signals elevated to three short sentences (open source, self-hostable, your data stays yours).
- **The Loop** — reordered Research → Pipeline → Prep as the primary flow (positions 01–03); Build and Letters tagged "· derived" at 04–05. Feedback caption rewritten to state what feeds back (interview outcomes → Research) and what regenerates on demand (Build, Letters).
- **Terminal sample** — replaced the resume-assembly-first flow with a prep-generation flow: user supplies interviewer names from calendar invite → T3 research fires → intel grids + scenario cards + anchor stories + line-that-lands populated per interviewer.
- **New section: "Why this, not a chat window?"** — four-panel differentiator block between Workspaces and Gallery. Structured research (fixed output shape per person), persistent workspace (state across weeks/months), calendar that knows prep-readiness state, open source trust story.
- **New section: "Your data is yours."** — AGPL/trust section promoted from footer mono tag to its own headline-tier block between Pricing and CTA. Names specific mechanisms (managed Postgres with row-level security, tenant-scoped, k ≥ 50 anonymization threshold, opt-in never default-on).
- **CTA** — "Stop managing files. Start running a process." → "Stop running your search from a chat window." Subhead enumerates the four differentiators.
- **TECH section** — removed redundant OPEN SOURCE · AGPL LICENSED mono tag now that the trust section carries that weight.
- **CSS additions** — `.loop-derived`, `.why-section`, `.why-grid`, `.why-item`, `.why-h`, `.trust-section`, `.trust-h` + responsive rule for the why-grid.

**Flagged as follow-up (structural, out of this brief's copy-only scope):**
The Loop currently renders 01–05 as five equal-weight flex cards. Tier treatment (primary = full card, derived = reduced opacity + smaller card footprint) would let the page argue the data model visually rather than relying on the "· derived" label alone. *(Addressed in v2 update below.)*

---

## v2 Update (2026-04-23)

The v1 delivery internalized ChatGPT/Claude chat as the competitor. Under corrected positioning — Facet is category-creating; the real incumbents are inertia and the absence of a workflow, not another product — that framing was removed from the live page. The v1 "Flagged as follow-up" item (structural tier treatment for Build and Letters) was also picked up in this pass.

### v2 deltas applied

- **Section rename — "Why this, not a chat window?" → "What Facet replaces."** Four-panel competitive framing replaced with five incumbents-to-displace: the spreadsheet nobody updates, the Claude-chat prep that died with the tab, the pile of resumes in Downloads, the recruiter emails lost track of, the panel research too tiring to do cold. The fifth bullet spans the grid full-width as a capstone — it's the unique-to-Facet claim and earns visual weight accordingly.
- **Hero body compression.** `Open source. Self-hostable. Your data stays yours.` → `Open source; your data stays yours.` Three trust beats compressed to one; self-hostable detail covered by the "Your data" section below.
- **CTA rewrite.** `Stop running your search from a chat window. / Identity model. Pipeline with rounds. Per-person research on the people actually asking. Open source. Your data stays yours.` → `Bring the discipline you ship with to your own search. / Identity model. Pipeline with rounds. Deep per-person research. Your data stays yours.` Heading drops the chat-window framing; subhead drops the separate "Open source." beat per the voice template.
- **The Loop — Build and Letters restructured as derived outputs.** v1 kept five equal-weight cards with "· derived" text labels. v2 separates them structurally: Research / Pipeline / Prep render as the primary three-card row; Build / Letters render as a smaller secondary row below, under a `DERIVED OUTPUTS` label, with dashed-border cards and opacity .75 (→ 1 on hover). The page now argues the data-model priority visually, not with text.
- **CSS additions** — `.loop-derived-label`, `.loop-secondary`, `.loop-sub-step` (+ hover + mobile stacking rule inside the existing media query). The orphaned `.loop-derived` class from v1 was left in place — harmless, zero usages after the loop restructure, avoided as a pointless diff.

### Voice template locked

v2 established "your data stays yours" as the AGPL-compression template: four words that do the work of a paragraph for an audience that doesn't need AGPL explained. Applied at every surface where the trust story appears — hero body, CTA subhead, trust section body.

### Updated copy specimens (v2 supersedes v1 where changed)

**Hero body (v2 trailing sentence only — rest of paragraph unchanged from v1):**

> …round by round. Open source; your data stays yours.

**"What Facet replaces." section (replaces v1's "Why this, not a chat window?"):**

- **The spreadsheet of applications nobody updates.** Rounds, schedules, outcomes, per-round prep — in the entry, not a row.
- **The Claude-chat prep that died when the tab closed.** Prep decks persist. Generate once, refine across weeks, walk in prepared.
- **The pile of resumes in Downloads.** Resume regenerated per opportunity from your identity model.
- **The recruiter emails you lost track of.** Pipeline entries hold the thread — JD, comp, contacts, round schedule, prep state — in the entry.
- **The panel research you're too tired to do cold.** You supply the names from the invite. Facet does the deep per-person work. *(full-width capstone row)*

**The Loop (v2 structural shape):**

Primary row (three equal cards, existing `.loop-step` treatment):

| # | Title | Body |
|---|---|---|
| 01 | Research | AI infers your search profile and scores fit per listing. You triage results. |
| 02 | Pipeline | Every opportunity with rounds, schedules, and per-interviewer capture. |
| 03 | Prep | Per-person intel, scenario cards, anchor stories, honest-bridge scripts. |

Feedback caption: ← Interview outcomes feed back into Research →

Derived outputs row (labeled `DERIVED OUTPUTS`, smaller cards, dashed border, opacity .75):

| Title | Body |
|---|---|
| Build | Resume regenerated per opportunity from your identity model. |
| Letters | Cover letters drafted from pipeline context and resume data. |

**CTA (v2):**

> **Bring the discipline you ship with to your own search.**
>
> Identity model. Pipeline with rounds. Deep per-person research. Your data stays yours.

### Workspaces restructure (late-v2)

The v1 brief explicitly deferred the Workspaces cards. v2's Loop restructure created two conflicts that made that deferral untenable:

1. **Hierarchy contradiction** — the Loop now rendered Research / Pipeline / Prep as primary and Build / Letters as derived outputs; the Workspaces grid continued to render all six cards at equal visual weight with Build badged `Core` and Letters badged `AI` as peer workspaces. Two sections of the same page argued opposite hierarchies.
2. **Redundancy with the trust section** — the `Persistence & Backup` card duplicated the new "Your data is yours." section almost verbatim (managed Postgres, row-level security, tenant-scoped, never accessed by Facet staff).

Changes applied:

- **Grid restructured to mirror The Loop.** Primary row (`.ws-grid-primary`, three cards, existing `.ws-card` treatment): Research, Pipeline, Prep. Derived row (`.ws-grid-derived`, two cards, transparent background, dashed border, opacity .75 → 1 on hover): Build, Letters. `DERIVED OUTPUTS` label between them, matching the `.loop-derived-label` pattern.
- **Persistence & Backup card removed.** Content lives in the "Your data" section at full headline-tier weight; duplication was noise.
- **Build card rewrite.** Feature-dump ("Typst WASM PDF rendering with WYSIWYG preview… 8 theme presets with full token-level overrides… dirty-state tracking… round-trippable JSON import/export") compressed to mechanism-first copy that names the derivation relationship: *"Resume regenerated per opportunity from your identity model. Per-bullet include/exclude, role-specific targeting, PDF render with live preview. Themes, density controls, and round-trippable JSON export."*
- **Letters card rewrite.** Dropped the internal "paragraph-level vector controls" jargon (the "vector" abstraction is Facet-internal and readable only after onboarding). Replaced with self-explanatory targeting language: *"Cover letters drafted from pipeline context — opportunity, company research, and your assembled resume data. Paragraph-level targeting, reusable templates, tuned per letter."*
- **Pipeline card micro-edit.** Dropped the closing "Hands off directly into Build and Prep" (peer-elevates Build) and the "vector linkage" field reference (internal terminology). Upgraded the calendar mention from feature-naming to value-naming: *"A cross-job calendar view surfaces prep-readiness beside every scheduled interview (in design)."*
- **Research and Prep cards unchanged.** Their existing copy already matched the v2 voice template; "You supply the names, Facet does the intel" on the Research card was the phrase that set the voice standard, not something v2 imposed.
- **Core / AI badges retained.** They convey load-bearing information for a privacy-sensitive audience (which surfaces use AI inference). Preserved across primary and derived cards.
- **CSS additions** — `.ws-grid-primary`, `.ws-grid-derived` (with derived-specific card override), `.ws-derived-label`, plus a mobile rule stacking both grids to single-column.

**The Workspaces section now argues the same hierarchy as The Loop on two independent surfaces.** A reader who skims Loop → Workspaces sees the same primary/derived story twice, not a contradiction.

---

## Scope

Substantive rewrite of `/Users/nick/Developer/atlascrew.dev/facet.html` — hero, The Loop section, differentiator section (new), terminal sample replacement, AGPL/trust elevation, CTA tightening. Workspace cards and pricing were already updated in a prior pass; don't rewrite unless there's a specific issue.

**Constraint:** Copy work only. Keep the existing visual design; structural layout changes are a separate pass.

## Audience

Senior engineers (and adjacent senior professionals — medicine, law, finance, consulting) running their own job search. Character:

- Reads privacy policies before signing up
- Skeptical of "AI-powered" career tools as a category
- Currently uses ChatGPT or Claude chat for parts of their search
- Pays attention to open-source status (AGPL is a trust signal, not an afterthought)
- Responds to specificity over superlatives; hype turns them off

## Target Positioning

Facet is an **identity-driven, research-intensive, interview-winning tool.** Three critical data models: identity, workspace people index (future), pipeline entry. Resume / cover letter / LinkedIn bio are *derived artifacts*, not peer workspaces. Interview prep is where the product wins.

**The real competitor is not Teal ($29/mo) or Final Round AI ($42/mo) or Interviewing.io ($225/session).** It's ChatGPT/Claude chat — what senior engineers already use for unstructured interview prep. Facet's argument: be that conversation with persistence, structure, and a workspace around it.

## Core Differentiators (lead with these)

1. **Three-tier research model.** Discovery (per listing), Pipeline (per entry), Pre-prep (per interviewer). You supply interviewer names from calendar invites; AI does the deep research per person. *Facet doesn't guess at who's interviewing you — it researches the people you tell it about.* This is the sharpest line on the page because every commodity tool violates it.

2. **Rounds as first-class objects** with scheduling, per-round interviewer capture, prep-deck links, outcome tracking. Cross-job calendar view that surfaces prep-readiness alongside scheduled interviews (in design).

3. **Structured prep output** — per-interviewer intel grid, line-that-lands per person, scenario cards with decision trees, anchor stories with sub-decisions, honest-bridge scripts for gap-framing.

4. **AGPL as trust engine** — self-hostable end-to-end. Opt-in anonymized aggregate intelligence for hosted users (not default-on collection). Senior professionals reading the privacy page see policy match reality.

## Never Claim (honesty boundaries)

- Don't say "AI-powered career platform" — commodity positioning, defensively weak
- Don't claim AI finds / identifies / suggests your interviewers — we explicitly don't do this; see differentiator #1
- Don't claim analytics dashboards, funnel charts, response-rate reports — explicitly out of scope
- Don't overclaim encryption — hosted-mode data is **encrypted at rest via managed Postgres with row-level security**, not end-to-end client-side. Export bundles use WebCrypto passphrase-based encryption (local download flow only).
- Don't claim comp negotiation features (planned but not shipped)
- No hype words: "revolutionary," "game-changing," "transform your career," "10x your search"

## Voice

- Senior-engineer-respectful — assume they've evaluated AI tools skeptically and will again
- Specific over generic — name the mechanism, not the outcome ("generates per-interviewer intel grids from public research" not "AI-powered prep")
- Opinionated — Facet makes deliberate design choices; present them as features, not apologies. "You supply the names; we don't guess" is a feature.
- Honest about tradeoffs — what Facet *doesn't* do is as telling as what it does
- Concrete — use real numbers where accurate (90-day passes, $149 price point, 7-day refund)

## Structural Agenda

1. **Hero** — current copy ("find the right jobs, assemble targeted materials, and prep for interviews") puts materials before prep and overweights resume assembly. Reframe around identity + research + interview depth. The tagline "Same diamond · Different face" is distinctive — keep it.

2. **The Loop** — currently sequences Research → Pipeline → Build → Letters → Prep. Build and Letters are peers to Prep, which misrepresents the architecture. Reorder to Research → Pipeline → Prep, with Build and Letters as derived outputs (sub-section or smaller visual treatment).

3. **New differentiator section** — "Why not just ChatGPT?" or equivalent. Name the structured-research argument, the persistent-workspace argument, the cross-job calendar argument, the AGPL trust argument. One or two sentences each; don't pad.

4. **Terminal sample** (inside Workspaces) — currently shows a resume-assembly-first flow. Replace with a prep-generation flow: user enters interviewer names → T3 research fires → structured prep deck generates.

5. **AGPL / trust** — currently a small mono tag at the bottom of the tech section. Promote to its own short section or a headline-tier paragraph. This is part of the trust story, not a footnote.

6. **CTA** — "Stop managing files. Start running a process." is decent but generic. Consider tightening with the sharper framing from the hero's answer.

## The Central Question (answer before writing any hero copy)

**What is the single sentence that sells Facet to a senior engineer who is mid-search, currently using ChatGPT for interview prep, and skeptical of AI career tools?**

Every other copy decision cascades from that answer. The briefing provides context; the sentence is yours to write.

**Delivered answer (2026-04-23):**

> Facet is the persistent workspace where you build an identity model, pipeline every process with rounds and schedules, and get deep per-person research on the interviewers you name — so every round is specific to the people actually asking.

## Reference Materials

- `backlog/docs/doc-20 - Data-Strategy-Privacy-Model-—-April-2026.md` — AGPL trust engine, opt-in aggregate model
- `backlog/docs/doc-25 - Prep-Workspace-Gap-Analysis-...md` — what prep depth means
- `backlog/docs/doc-28 - Prep-Workspace-Structural-Additions-...md` — Phase 1 shipped, Phase 2 spec'd
- `backlog/docs/doc-29 - Close-Out-Hosted-Persistence-...md` — real infrastructure state
- `backlog/docs/doc-30 - Pipeline-Depth-...md` — three-tier research, rounds, calendar
- Project memories at `~/.claude/projects/-Users-nick-Developer-Facet/memory/` — especially `project_critical-models-and-scopes.md`, `project_ai-inference-vs-user-input.md`, `project_search-pipeline-prep-flow.md`
- Updater interview-prep artifacts (in basic-memory vault `facet/main/ref-materials/`) — the output-quality target the prep system is designed to produce

## Known-good vs Known-bad Examples (from the pre-rewrite page)

**Kept:**
- "Same diamond · Different face" — distinctive tagline
- "Open source, self-hostable." — accurate (elevated to its own section)

**Fixed:**
- "AI-Powered Career Platform" — weak positioning → "Identity-driven workspace for serious interview prep"
- "The system gets smarter with every interaction" — vague → removed; feedback loop named mechanically in the Loop caption ("Interview outcomes feed back into Research")
- "Build a deep model of who you are professionally" — abstract → "Build a structured library of your roles, accomplishments, and anchor stories"
- "AI generates cards from the JD, your resume, and company research" — commodity framing → replaced with mechanism-named copy in Prep card and in the "Why a workspace" section

---

## Appendix — Copy Specimens Delivered

### Hero body

> An identity-driven workspace for the research-intensive job search. Build a structured library of your roles, accomplishments, and anchor stories. You supply the names on your panel — Facet does the deep per-person research, round by round. Open source. Self-hostable. Your data stays yours.

### The Loop

| # | Title | Body |
|---|---|---|
| 01 | Research | AI infers your search profile and scores fit per listing. You triage results. |
| 02 | Pipeline | Every opportunity with rounds, schedules, and per-interviewer capture. |
| 03 | Prep | Per-person intel, scenario cards, anchor stories, honest-bridge scripts. |
| 04 | Build · derived | Resume regenerated per opportunity from your identity model. |
| 05 | Letters · derived | Cover letters drafted from pipeline context and resume data. |

Feedback caption: ← Interview outcomes feed back into Research. Build and Letters regenerate on demand. →

### "Why this, not a chat window?" (new section)

- **Structured research, not a prompt.** ChatGPT can research an interviewer if you type the right prompt. Facet does it automatically, per person, with a fixed output shape — role, background, what they care about, the line that lands for each. Same depth every time, on every round.
- **Persistent workspace, not a conversation.** Your identity model, every opportunity, every round, every prep deck — in one place, across weeks and months. Not scattered across a hundred chat tabs you can't find.
- **A calendar that knows what it's looking at.** Every scheduled round surfaced with its prep-readiness state. "3 days to Doug's technical, deck drafted but unreviewed." A chat window doesn't know who you're prepping for tomorrow. *In design — shipping after the round schema lands.*
- **Open source, your data stays yours.** AGPL-licensed and self-hostable end to end. In hosted mode: encrypted at rest with row-level security, never accessed by Facet staff. You can run Facet at full depth and share nothing.

### Terminal sample

```
// Round 2 scheduled — panel at Acme Corp, Tuesday 2pm
pipeline : round added · format: panel · prep: not started
> interviewers = Doug K, Priya S, Marcus T, Lin W   // from calendar invite
> facet prep --round=2
✓ T3 research complete — per-person intel grids populated
✓ scenario cards drafted (behavioral × 4, technical × 3)
✓ anchor stories mapped per interviewer
✓ "line that lands" ready for each name
prep deck ready — 19 cards · calendar: 3 days out, drafted, unreviewed
// Debrief captured after the round → identity meta-learning updated
```

### "Your data is yours." (new section)

> AGPL-licensed and self-hostable end to end. Run Facet on your own infrastructure for full custody — the license requires it stay open source.
>
> In hosted mode, your data lives in managed Postgres with row-level security — tenant-scoped so Facet staff can't read your identity model, your pipeline, or your prep decks. Export encrypted backups any time; delete your account and the data goes with it.
>
> Aggregate intelligence features (planned) are opt-in, never default-on. Anonymization threshold k ≥ 50 — no aggregate bucket reports fewer than 50 users. You can use Facet at full depth and share nothing.

### CTA

> **Stop running your search from a chat window.**
>
> Identity model. Pipeline with rounds. Per-person research on the people actually asking. Open source. Your data stays yours.
