---
Status: Plan / spec
Relates to:
  - doc-5 (Tenant-Aware Persistence Architecture) — persistence substrate
  - doc-20 (Data Strategy & Privacy Model) — individual/aggregate policy
  - doc-24 (Search Workspace Redesign) — owns T1 (discovery-tier research)
  - doc-25 (Prep Workspace Gap Analysis) — prep side motivation
  - >-
    doc-28 (Prep Workspace Structural Additions) — provides
    `PrepInterviewerIntel` type reused here for dossiers
  - >-
    doc-29 (Close Out Hosted Persistence) — infrastructure; this doc adds domain
    data that rides through the same persistence layer
Scope: >-
  Pipeline workspace depth — rounds as first-class entities, a three-tier
  research model (T1 search, T2 pipeline-add, T3 pre-prep), user-sourced
  interviewer capture, calendar as a read-model, and the prep-integration
  contract. Explicitly excludes analytics / funnel / reporting / meta-commentary
  features.
id: doc-30
title: 'Pipeline Depth — Rounds, Research Tiers, and the Calendar'
type: other
created_date: '2026-04-23 14:34'
---

# Pipeline Depth — Rounds, Research Tiers, and the Calendar

## Context & Motivation

This plan is the product of one scoping session that progressively corrected three drafts of the same problem. The corrections matter — they shape every decision below:

1. **Prep quality is capped by research depth.** Phase 1 of doc-28 added `PrepInterviewer` records to prep decks, but the generator infers those records from whatever `PipelineResearchSnapshot.people[]` holds — today a flat `{ name, title, company, profileUrl?, relevance }` shape with one-sentence relevance. The Updater interview-prep artifacts demonstrated what prep looks like when research is actually deep — each panelist had a real intel grid because the investigation went deep per person. Closing that gap is this document's primary purpose.

2. **Pipeline is not thin glue.** Earlier framings called pipeline a "conveyor belt" not worth depth investment. That's wrong for two reasons: (a) pipeline owns the investigation layer that feeds prep (company research, JD analysis, per-person dossiers), and (b) outcome-touching workflow features — rounds, scheduling, a calendar across all tracked jobs, prep-readiness signals — are genuinely differentiating. Analytics dashboards and funnel reports are the thin part that doesn't earn investment. Outcome-touching workflow + investigation layer = pipeline depth.

3. **Wrong > missing for transient specifics.** The current `investigatePipelineEntry` auto-discovers interviewers via LinkedIn-mention-plus-title heuristics. The discovered people are typically wrong (not the actual panel), and wrong-but-confident AI output erodes trust more than a blank field does. The correct pattern is what worked for the Updater artifacts: the user supplies names (they're in the calendar invite), and AI does the deep research on those specific names.

## Guiding Principles

Saved as memories in this session; referenced here for alignment:

- **AI inference for static context, user input for transient specifics.** Company context, JD intent, market position, and skill patterns are AI-inferrable. Interviewer identity, panel assignments, and scheduling-dependent data are user-sourced. Never infer who's interviewing you.
- **Pipeline depth includes investigation AND outcome-touching workflow.** Rounds, scheduling, calendar, per-round interviewer capture earn depth investment. Analytics dashboards, funnel charts, batch operations do not.
- **Research is tiered.** T1 / T2 / T3 with distinct triggers, frequencies, and consumer relationships. Each tier is heavy inference (all top-shelf model), differentiation is volume × multiplicity, not per-call cost.
- **AGPL + client-side transparency** (from doc-20 and doc-29). Research that runs client-side remains auditable. Server-side research runs under a service-role boundary with logged access.

## Current State (verified)

Types in `src/types/pipeline.ts`:

```ts
// Today
interface PipelineEntry {
  // ...
  rounds: number | null               // scalar count
  format: InterviewFormat[]           // flat tags; no per-round assignment
  research?: PipelineResearchSnapshot
  // ...
}

interface PipelineResearchSnapshot {
  status: 'seeded' | 'investigated'
  summary: string
  jobDescriptionSummary: string
  interviewSignals: string[]
  people: PipelineResearchPerson[]    // ← T2 auto-discovers; usually wrong
  sources: PipelineResearchSource[]
  searchQueries: string[]
  lastInvestigatedAt: string
}

interface PipelineResearchPerson {
  name: string
  title: string
  company: string
  profileUrl?: string
  relevance: string                   // ← one-sentence, thin feed to prep
}
```

Types already added on the prep side (doc-28 Phase 1 — commits `9f4c270` / `49d74c9` / `72b3880`):

```ts
interface PrepInterviewer {
  id: string
  name: string
  title?: string
  linkedInUrl?: string
  intel: PrepInterviewerIntel
  lineThatLands?: string
}

interface PrepInterviewerIntel {
  role?: string
  background?: string
  stack?: string
  caresAbout?: string
  yourAngle?: string
  keyTell?: string
  linkedInPositioning?: string
  education?: string
}
```

The prep side is already shaped for rich per-person intel. The pipeline side feeds it thin content. This doc fixes the feed.

Existing code paths:
- `src/utils/pipelineInvestigation.ts` / `investigatePipelineEntry()` — produces the snapshot including auto-discovered people
- `src/utils/prepGenerator.ts` / `normalizeInterviewers()` — converts whatever the AI outputs into `PrepInterviewer` records
- `src/utils/prepPipelineContext.ts` — translates pipeline research into prep generation context (this is where the dossier-to-prep seam lives)

## Target Shape — Rounds as First-Class

```ts
export type PipelineRoundOutcome = 'pending' | 'advanced' | 'rejected' | 'ghosted' | 'completed'

export interface PipelineRound {
  id: string
  label: string                             // "Recruiter screen", "HM", "Doug technical", "Panel"
  format: InterviewFormat                   // reuse existing enum
  scheduledFor?: string                     // ISO; null until user knows
  durationMinutes?: number                  // useful for calendar rendering
  interviewers: PipelineInterviewer[]       // user-entered; see §Interviewer Capture
  prepDeckId?: string                       // link to PrepDeck; at most one per round in v1
  outcome?: PipelineRoundOutcome
  outcomeAt?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface PipelineInterviewer {
  id: string
  name: string
  title?: string
  linkedInUrl?: string
  /**
   * T3 research output. Populated on prep-gen-intent; empty until then.
   * The intel grid shape is intentionally aligned with PrepInterviewerIntel
   * so the prep generator can read it directly without translation.
   */
  dossier?: PrepInterviewerIntel
  lineThatLands?: string
  researchedAt?: string
}

// PipelineEntry gains:
//   rounds: PipelineRound[]
//
// PipelineEntry deprecates:
//   rounds: number          ← kept for backcompat, derived from rounds.length
//   format: InterviewFormat[] ← kept for backcompat; per-round format is the truth
//
// PipelineResearchSnapshot.people[] is deprecated (T2 no longer writes there;
// read path ignores). Existing rows keep whatever was there until next save.
```

The intentional alignment `PipelineInterviewer.dossier: PrepInterviewerIntel` is load-bearing: prep and pipeline share the intel shape so the prep generator reads dossiers directly instead of re-deriving them from a different source type. Phase 1 was explicitly sized to enable this reuse.

## Tiered Research Model

| Tier | Trigger | Scope | Consumes from prior tier | Writes to |
|---|---|---|---|---|
| **T1 Discovery** | Per search result | Role + company surface + JD + fit-to-vectors | — | Search result record; inherits forward if promoted |
| **T2 Pipeline-add** | Async on promote to pipeline; manual refresh | Company summary + JD analysis + interview signals + market position. **No people.** | T1 context if available | `PipelineEntry.research` (minus `people[]`) |
| **T3 Pre-prep** | Explicit prep-gen intent | Per-person deep research on user-supplied names | T2 context + user-entered names | `PipelineInterviewer.dossier` and `.lineThatLands` on the round's interviewers |

All three tiers are heavy inference (top-shelf model, real context, often web-augmented). Differentiation is volume × multiplicity × trigger-frequency, not per-call economics:

- **T1** — highest aggregate cost. Many searches × many results × per-result evaluation. Cost control is cross-search memoization (doc-24 territory).
- **T2** — moderate aggregate cost. Per-entry on promote, plus refresh on TTL or manual bump. Cost control is one-time-plus-explicit-refresh (not re-run on every view).
- **T3** — low aggregate cost, high per-call. Only fires on prep-gen intent, which maps to interviews-actually-reached (~10-20% of pipeline). Cost control is trigger gating — the user signals intent explicitly.

**Important:** tiers are *additive*. T2 receives T1 context; T3 receives T2 context plus user-entered names. No tier re-derives what the prior tier produced.

## Interviewer Capture

User-sourced, always. The pattern:

1. Interview is scheduled — the user receives a calendar invite from the recruiter with the panel names
2. User opens the pipeline entry, adds (or clicks into) the relevant round
3. Inline form: name, title (optional), LinkedIn URL (optional; paste from invite if handy)
4. User can add / edit / remove interviewers at any time before prep-gen

Minimal friction. The UX target is "paste four names and the rest fills itself in later when you generate prep."

What the system **does not** do:
- Auto-discover interviewers from company research
- Speculate on likely panel members based on role patterns
- Fill in interviewer data from LinkedIn scraping without explicit user confirmation

This is the implementation of the **wrong > missing** principle. The failure mode of auto-discovery (confident-sounding wrong names) is worse than the friction of manual entry.

What happens to `PipelineResearchSnapshot.people[]`?
- T2 stops writing to it
- Read path ignores it
- Migration: leave existing data in place; on next T2 refresh the field stays empty
- Long-term: can be dropped from the schema entirely once Phase 1 of this doc lands

## Pre-Prep Research Flow (T3)

Explicit sequence when user triggers prep-gen for a round:

1. **Client** opens the prep-gen UI scoped to a specific `PipelineRound`
2. If `round.interviewers[]` is empty, UI prompts: "who's interviewing you?" Inline capture; user enters names + optional titles + optional LinkedIn URLs
3. **Client POSTs** to the prep generator endpoint (via the existing Fly-deployed proxy, per doc-29) with round context + interviewer names
4. **Generator runs T3** — per-person deep research. For each interviewer:
   - Fetches + analyzes LinkedIn profile (if URL provided; if not, tries name + company)
   - Searches for GitHub history (when technical role signal)
   - Scans public talks, blog posts, podcast appearances
   - Infers `PrepInterviewerIntel` fields (role, background, stack, caresAbout, keyTell, linkedInPositioning, education)
   - Composes `lineThatLands` grounded in `caresAbout` (per doc-28 Phase 1 prompt instructions)
5. **Writes** dossier back to `PipelineEntry.rounds[roundId].interviewers[interviewerId].dossier` (via the proxy's persistence API)
6. **Generator produces the PrepDeck** using the enriched data, stores with `prepDeckId` on the round

Result: dossiers live on the pipeline entry (shared if user regenerates) but are populated by prep-gen-triggered work (not background speculation).

**Refresh semantics**: if a dossier exists (`researchedAt` is set), prep-gen uses it as-is unless the user explicitly clicks "refresh research" on the interviewer card. TTL is a follow-up — 14 days is a reasonable default but not required in v1.

## Calendar View (Design, Not v1 Build)

A read-model across all pipeline entries in the workspace:

```
SELECT round.*, entry.company, entry.role, entry.vector_id
FROM pipeline_entries entry
JOIN unnest(entry.rounds) round
WHERE round.scheduledFor IS NOT NULL
ORDER BY round.scheduledFor ASC
```

For each event the view surfaces:
- Date/time, format, company + role
- Round label ("Doug technical", "Panel", "HM")
- **Prep-readiness state**: no deck / drafted / reviewed / practiced (derived from `prepDeckId` + PrepDeck's study progress)
- **Lead-time signal**: days until; urgency pill if < 48h and no prep deck
- **Post-interview state**: outcome capture prompt if `scheduledFor < now` and `outcome` is pending
- **Round-level debrief prompt**: after a completed round, link to debrief workspace with prefilled context (follow-up)

**Value** (the reason this is a feature, not a UI flourish): a user with 8 active processes and 12 scheduled rounds across 3 weeks cannot hold the full picture in their head. A state-aware calendar that surfaces "3 days to Doug's technical, prep deck drafted but unreviewed" is qualitatively different from a generic calendar entry. This is where Facet becomes the command center for the search, not a spreadsheet with extra fields.

**Scope for v1 of this plan**: design the data such that the calendar is a read-query plus a UI component, not a separate data structure. The schema lands in v1; the UI ships when we get to it.

**Surface location**: open question (§Open Items) — dedicated `/calendar` route vs inline on `/pipeline`. Recommendation leans toward dedicated route since the cross-entry aggregation is the whole point of the view.

## Prep Integration

Changes to the prep side:

- `PrepDeck` gains: `pipelineRoundId?: string` (in addition to the existing `pipelineEntryId`)
- `PrepDeck.interviewers[]` is populated by *reading* `PipelineEntry.rounds[roundId].interviewers[].dossier` at generation time — no duplication
- Generator prompt already knows how to emit `PrepInterviewer` records (doc-28 Phase 1 `normalizeInterviewers()`); the new work is the generator's input source: it reads from `PipelineRound.interviewers[]` when a `pipelineRoundId` is provided, falls back to the entry-level research otherwise

One migration-forward note: decks generated under the current flow (no `pipelineRoundId`, generator composing interviewers from whatever it could guess) don't round-trip cleanly. Since there's no precious data in pipeline right now (founder uses Claude chat for active search), the cleanest migration is to flag legacy decks as needing regeneration and leave them alone.

## Migrations

One migration at the type layer, staged to land with the client-side UI incrementally:

1. **Type additions** — `PipelineRound`, `PipelineInterviewer` in `src/types/pipeline.ts`; `rounds: PipelineRound[]` on `PipelineEntry`. Optional fields so existing entries (all with `rounds: []`) don't fail validation.
2. **`PipelineEntry.rounds: number | null` → derived** — keep the type field, compute from `rounds.length` in readers, mark as deprecated. Remove entirely in a later pass once all call sites use `rounds[]`.
3. **T2 investigator change** — `investigatePipelineEntry()` stops populating `research.people[]`. Existing entries keep their snapshots; next refresh produces an empty `people[]`.
4. **Prep generator input** — accept `pipelineRoundId` in `PrepGenerationRequest`; read interviewers from the round when provided.
5. **Schema migration on the server** — `workspace_snapshots.artifacts` JSONB carries the new shape automatically (doc-29's snapshot-as-JSONB pattern doesn't require server schema changes for additive fields).

No data loss. Pre-launch; no migration script required for real user data.

## Client UI (what ships in v1)

Keeping UI work bounded:

- **Pipeline entry detail page** gains a "Rounds" section — add/edit rounds inline, per-round form captures label + format + scheduledFor (optional) + interviewers (inline name + title + LinkedIn URL fields)
- **Round editor** — the minimum: edit the round's fields, save, done. No fancy modals.
- **Prep-gen button per round** — triggers T3 research + deck generation; UI shows progress ("Researching interviewers... drafting deck...") and routes to the generated deck
- **Outcome capture per round** — dropdown + optional notes after scheduled date passes
- **Calendar view** — design the data but DO NOT ship the UI in v1; follow-up doc / follow-up sprint

## Explicitly Out of Scope

- Analytics dashboards, funnel charts, response-rate graphs, time-to-offer stats — doesn't move outcomes
- Batch operations across many entries — not a real workflow need today
- AI-driven auto-discovery of interviewers — violates wrong>missing
- Team / multi-user / shared-pipeline features — Wave 1+ concern
- Calendar *UI build* (design the data, defer the view implementation)
- Automatic calendar-invite ingestion (parse recruiter's .ics and populate rounds) — nice idea, but defer; user can paste names from the invite for now
- Integration with external calendar systems (Google Calendar, iCal) — beyond this plan

## Sequencing

Atomic PRs / migrations, in order:

1. **Type additions** (`PipelineRound`, `PipelineInterviewer`) + `PipelineEntry.rounds: PipelineRound[]` — one PR, types only, no behavior change
2. **T2 investigator stripped of people discovery** — one PR; `people[]` stays empty on new snapshots; read path ignores
3. **Pipeline UI — round editor + interviewer capture per round** — one PR, bulk of the UI work
4. **Prep generator accepts `pipelineRoundId`; reads interviewers from round** — one PR on the generator + client wiring
5. **Prep-gen-intent flow triggers T3 research** — one PR; adds the research-then-generate path in the client, corresponding Edge Function or Fly proxy endpoint for the T3 work
6. **Round-level outcome capture** — one PR
7. **doc-29 items in parallel** — RLS + bootstrap trigger are orthogonal; can land before or after this work

## Open Items / Follow-Ups

1. **Round type enum vs reused InterviewFormat**: today `InterviewFormat[]` is flat at entry level. Proposal: reuse `InterviewFormat` directly per-round. Revisit if rounds need formats the flat list doesn't capture.
2. **TTL for T2 research**: proposed 14 days, refresh button overrides. Confirm before v1 lands.
3. **Multiple prep decks per round**: proposed 1:1 for v1; relax if a user case emerges for "I want two different prep angles for the same round" (probably not, but flag).
4. **Where does per-round debrief live?** `PipelineRound.debriefId` linking to `debriefStore`? Or debrief becomes round-scoped in this doc's schema? Probably the former (debriefs stay their own artifact, linked by id). Out of scope for this doc but flagged.
5. **Calendar UI surface**: dedicated `/calendar` route (recommended) vs embedded section on `/pipeline`. Design call before the UI ships.
6. **Auto-parse calendar invites (.ics)**: tempting future feature; explicitly deferred. User pastes names by hand for v1.
7. **TTL invalidation for T3 dossiers**: how stale before re-research? Probably irrelevant for single-use (interview happens once), but noteworthy for cross-round reuse (same person on multiple rounds).
8. **Round reordering**: drag-and-drop? Or use `createdAt` ordering? Simplest: use `scheduledFor` then `createdAt` as the display order; no manual reorder in v1.
9. **Prep-readiness computation**: needs a deterministic signal. Proposal: `no deck` < `deck drafted` (just generated) < `deck reviewed` (user opened it) < `practiced` (PrepPracticeMode session recorded). Revisit.
10. **T3 cost gating**: should we require the user to be on a paid tier before T3 fires? Billing infrastructure exists (`billing_accounts`, Stripe). Probably yes, but configurable. Not a v1 blocker.

## References

- **doc-5** — Tenant-Aware Persistence Architecture (substrate)
- **doc-20** — Data Strategy & Privacy Model (individual vs aggregate data posture)
- **doc-24** — Search Workspace Redesign (owns T1 discovery-tier research)
- **doc-25** — Prep Workspace Gap Analysis (prep-side motivation for this work)
- **doc-28** — Prep Workspace Structural Additions (defines `PrepInterviewerIntel` type reused here)
- **doc-29** — Close Out Hosted Persistence (infrastructure this rides on)
- **Memories:**
  - `project_search-pipeline-prep-flow.md` — core flow + pipeline depth dimensions
  - `project_ai-inference-vs-user-input.md` — wrong > missing principle
  - `project_persistence-architecture.md` — three-tier persistence model
- **Existing code:**
  - `src/types/pipeline.ts` — PipelineEntry, PipelineResearchSnapshot, PipelineResearchPerson, InterviewFormat
  - `src/types/prep.ts` — PrepInterviewer, PrepInterviewerIntel, PrepDeck, PrepCard (Phase 1 shipped)
  - `src/utils/pipelineInvestigation.ts` — `investigatePipelineEntry()` (T2, requires strip-of-people-discovery change)
  - `src/utils/prepGenerator.ts` — `normalizeInterviewers()` (Phase 1; accepts the intel shape directly)
  - `src/utils/prepPipelineContext.ts` — the pipeline → prep translation seam
  - `src/persistence/contracts.ts` — `FacetWorkspaceSnapshot` (domain data rides through here, no schema change needed for additive fields)
- **Updater reference artifacts** (in basic-memory vault under `facet/main/ref-materials` per doc-28 context): `updater-panel-prep.html`, `updater-doug-prep.html` — these are the output quality target for what this plan's tiered research enables
- **Phase 1 commits:** `9f4c270` (schema), `49d74c9` (generator), `72b3880` (renderer), `40d514e` (doc-28 plan)
