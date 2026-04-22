---
id: doc-24
title: 'Search Workspace Redesign — Search Thesis, Semantic Depth, Feedback Loop'
type: other
created_date: '2026-04-19 04:44'
updated_date: '2026-04-19 05:03'
---
# Search Workspace Redesign — Search Thesis, Semantic Depth, Feedback Loop

Fundamental problems with the Research workspace and design for fixing them. Reference material: the founder's own job search reports (Platform/Security Platform Report + "Where Builders Beat Leetcoders"), Job Search Parameters HTML, and Pipeline Tracker HTML demonstrate the quality bar.

---

## Problem Summary

The search workspace sends a decontextualized list of skills and constraints to the AI and gets back thin results. Compare to the reference reports which open with strategic theses, identify unfair advantage combinations, explain WHY the candidate wins at each company, and group results by signal convergence.

Seven fundamental problems:
1. **No search thesis** — no strategic hypothesis about where/why the user has unfair advantage
2. **Skill depth is structural, not semantic** — keyword counting can't distinguish "architected" from "hand-wrote"
3. **No unfair advantage surfacing** — flat skill lists don't identify rare valuable combinations
4. **Results are thin** — `matchReason: string` vs multi-paragraph "Why this candidate wins here"
5. **No feedback loop** — user reactions don't feed back to identity model
6. **Prompt doesn't leverage compound context** — self_model, arc, philosophy, archetype, PAIO bullets all absent from search prompt
7. **Interview preferences disconnected from strategy** — flat string lists, not connected to candidate archetype advantage

---

## Data Flow: Search → Pipeline → Downstream

The pipeline is the junction point in Facet's architecture. Search results flow in from the left; resume, cover letter, and interview prep features pull from the right. The richer the pipeline entry, the better everything downstream works.

### The Two Models That Power Everything

**Identity Model** (`ProfessionalIdentityV3`) — who the user is:
- Career narrative, archetype, philosophy
- Skills with depth, context, positioning
- Roles with PAIO bullets (problem, action, impact, outcome)
- Search vectors with thesis, keywords, target roles
- Preferences (compensation, interview process, matching filters)
- Voice / generator rules

**Job Model** (`PipelineEntry`) — the specific opportunity:
- Company, role, tier, compensation
- Job description text
- Vector alignment (which positioning angle fits this role)
- Positioning narrative ("Why I'm a fit")
- Skill match (which specific skills align)
- Interview format (what the process looks like)
- Research snapshot (company intel, sources, interview signals)
- Resume variant used
- Process tracking (status, application method, response, rounds, outcomes)

### Compound Context at Each Downstream Step

Every downstream feature combines both models:

```
Identity Model + Job Model → Downstream Output
─────────────────────────────────────────────────────────
Resume Assembly:
  identity.skills + identity.roles     →  component selection
  + pipeline.vectorId                  →  which vector/angle to target
  + pipeline.skillMatch                →  which bullets to prioritize
  + pipeline.positioning               →  target line / summary framing
  = Tailored resume for this specific opportunity

Cover Letter:
  identity.self_model + identity.voice →  how the user talks
  + pipeline.jobDescription            →  what the company wants
  + pipeline.positioning               →  the "why me" narrative
  + pipeline.research (company intel)  →  company-specific hooks
  = Natural-sounding letter from a specific person about a specific opportunity

Interview Prep:
  identity.roles (PAIO bullets)        →  stories to draw from
  + identity.self_model.interview_style → interview strengths/weaknesses
  + pipeline.format[]                  →  what kind of prep is needed
  + pipeline.jobDescription            →  what they'll ask about
  + pipeline.positioning               →  which angles to emphasize
  + pipeline.research.interviewSignals →  specific process intelligence
  = Prep cards customized to this company/round/format

Comp Negotiation (planned):
  identity.preferences.compensation    →  floor, target, notes
  + pipeline.comp                      →  what the role pays
  + pipeline.offerAmount               →  actual offer received
  + pipeline.positioning               →  leverage points
  = Negotiation strategy with specific leverage and fallback positions
```

### Pipeline Entry Model Is Already Solid

The current `PipelineEntry` type (`src/types/pipeline.ts`) is nearly a 1:1 match with the founder's manual Pipeline Tracker HTML. Full comparison:

| Manual Tracker | `PipelineEntry` | Status |
|---|---|---|
| Company / Role / Tier / Status | `company`, `role`, `tier`, `status` | ✅ |
| Comp / URL / Contact | `comp`, `url`, `contact` | ✅ |
| Vector Match | `vectorId` | ✅ |
| **Positioning ("Why I'm a fit")** | `positioning` | ✅ |
| **Skill Match** | `skillMatch` | ✅ |
| Next Step / Notes | `nextStep`, `notes` | ✅ |
| Application Method | `appMethod: ApplicationMethod` | ✅ (6 values) |
| Response Type | `response: ResponseType` | ✅ (6 values) |
| Days to Response / Rounds | `daysToResponse`, `rounds` | ✅ |
| Interview Format (multi-select) | `format: InterviewFormat[]` | ✅ (13 format types) |
| Rejection Stage / Reason | `rejectionStage`, `rejectionReason` | ✅ |
| Offer Amount | `offerAmount` | ✅ |
| Date Applied / Closed | `dateApplied`, `dateClosed` | ✅ |
| Resume Variant | `resumeVariant` | ✅ |
| History | `history: PipelineHistoryEntry[]` | ✅ |
| Research Snapshot | `research: PipelineResearchSnapshot` | ✅ |
| Job Description | `jobDescription` | ✅ |
| Resume Generation State | `resumeGeneration` | ✅ |

The pipeline data model doesn't need structural changes — it needs richer *population* from better search results.

### How Enriched Search Results Map to Pipeline

When a search result is pushed to the pipeline, the new enriched fields map directly:

| Enriched `SearchResultEntry` Field | Maps to `PipelineEntry` Field |
|---|---|
| `candidateEdge` ("Why this candidate wins") | → `positioning` |
| `matchReason` + `advantageMatch` | → `skillMatch` (or enriches `positioning`) |
| `interviewProcess.format` | → `format[]` (pre-populate interview format) |
| `interviewProcess.builderFriendly` | → `notes` or `research.interviewSignals` |
| `interviewProcess.aiToolsAllowed` | → `research.interviewSignals` |
| `companyIntel.stage` | → `research.summary` |
| `companyIntel.aiCulture` | → `research.summary` or `notes` |
| `companyIntel.remotePolicy` | → `notes` |
| `companyIntel.openRoleCount` | → `notes` |
| `signalGroup` | → `tier` mapping or `notes` |
| `vectorAlignment` | → `vectorId` |
| `estimatedComp` | → `comp` |
| `risks[]` | → `notes` |

The current `createPipelineEntryDraft()` in `researchUtils.ts` already does basic mapping (`matchReason` → `positioning`, `risks` → `notes`). The enriched schema just gives it more to work with — the mapping function gets richer, not different.

### What This Means for the Search Redesign

The search workspace's job is to populate `PipelineEntry` fields as richly as possible, because every downstream feature multiplies that richness:

- A thin `positioning` field produces a generic cover letter
- A rich `positioning` ("Built eBPF endpoint agent at A10, managed WAF sensor fleets across 400+ deployments. This is almost exact prior-art for managing lifecycle of millions of endpoint agents.") produces a cover letter that recruiters cite when reaching out

- A missing `format[]` means generic interview prep
- A pre-populated `format: ['take-home', 'system-design']` means prep cards tailored to those specific formats

The search redesign directly improves every downstream feature by producing richer pipeline entries. The pipeline model doesn't change — it just gets filled better.

---

## Identity Model Gap Analysis

The founder's Job Search Parameters document (`/Users/nick/Documents/Career/Job Search/Job Search Parameters.html`) represents the ideal input for search. Mapping it against the current identity model (`ProfessionalIdentityV3` in `src/identity/schema.ts`) reveals what's covered and what's missing.

### What the Identity Model Already Captures (~80%)

| Parameters Doc Section | Identity Model Location | Coverage |
|---|---|---|
| Compensation floor/target | `preferences.compensation.base_floor`, `base_target` | ✅ Good |
| Location / remote | `identity.location`, `preferences.work_model` | ✅ Good |
| Clearance | `preferences.constraints.clearance` | ✅ Good |
| Skills with depth | `skills.groups[].items[]` with `name`, `depth`, `context`, `positioning` | ⚠️ Structure exists but depth is heuristic, context underused |
| Search vectors with priority | `search_vectors[]` with `title`, `thesis`, `target_roles`, `keywords` | ✅ Good |
| Interview process preferences | `preferences.interview_process.strong_fit_signals[]`, `red_flags[]` | ⚠️ Flat strings, no archetype connection |
| Include/Exclude filters | `preferences.matching.prioritize[]`, `avoid[]` | ⚠️ Flat labels, nuance lost |
| Work history | `roles[]` with PAIO bullets | ✅ Good |
| Open source projects | `projects[]` | ✅ Good |
| Open questions / gaps | `awareness.open_questions[]` | ✅ Good |
| Career narrative / archetype | `self_model.arc`, `self_model.philosophy` | ✅ Good |
| Interview style strengths | `self_model.interview_style` | ✅ Good |
| Profiles / summary narratives | `profiles[]` | ✅ Good |

### What's Missing (~20% — but the highest-signal 20%)

#### Gap 1: Semantic Skill Depth Levels

**Current:** `depth?: 'strong' | 'working' | 'basic' | 'avoid'` (optional, usually heuristic-inferred)

**Needed:** Richer depth levels that distinguish HOW the user engaged with a technology:

```typescript
type SemanticSkillDepth =
  | 'expert'          // daily driver, deep production use, years of experience
  | 'strong'          // significant production use, comfortable leading work
  | 'hands-on-working' // used meaningfully, can work in it, not primary
  | 'architectural'   // designed systems using it, directed others, didn't write code
  | 'conceptual'      // understands it, can discuss intelligently, hasn't built with it
  | 'basic'           // minimal use, willing to learn
  | 'avoid'           // don't want roles requiring this
```

**Example from parameters doc:**
- Kubernetes: `strong` BUT "Not a k8s admin. Building platforms around it is fine."
- Rust: `working` — "builds production systems in Rust with AI augmentation, not writing unsafe blocks from scratch"
- eBPF: `working` — "AI-assisted development — did not hand-write BPF programs"

The distinction between `strong` (user) and `strong` (admin) is the kind of nuance that prevents wrong search results. `architectural` vs `hands-on-working` prevents the Rust overselling problem.

**Schema change:** Update `SkillItem.depth` to accept richer values. Backward-compatible — old values still valid, new values additive.

#### Gap 2: Search Signal Annotation Per Skill

**Current:** No equivalent. `positioning` field exists but is underused.

**Needed:** Per-skill guidance for how to USE the skill in search context:

```typescript
interface SkillItem {
  // ... existing fields ...
  searchSignal?: string  // "Strong match signal. List first."
                         // "Can mention. Avoid 'deep Rust required' roles."
                         // "Signals Windows release engineering depth."
                         // "Don't lead with this."
}
```

This tells the thesis generator and search prompt how to weight and position each skill. The `positioning` field on `SkillItem` could serve this purpose if consistently populated — may not need a new field, just consistent use.

#### Gap 3: Honest Framing / Anti-Overselling Notes

**Current:** No structured location for "what I am NOT."

**Needed:** Per-skill-group calibration notes that prevent AI overselling:

```typescript
interface SkillGroup {
  // ... existing fields ...
  calibration?: string  // "Not a traditional security engineer — no certs, not a pentester.
                        //  Strength is building security platforms."
}
```

These are crucial for the search thesis — they calibrate the AI's positioning and prevent it from suggesting roles the user can't back up in an interview.

#### Gap 4: Filter Nuance / Qualifying Context

**Current:** `preferences.matching.avoid[]` stores `{ id, label, description, severity }`.

**Needed:** Qualifying context that distinguishes conditional avoids from absolute avoids:

```typescript
interface MatchingFilter {
  id: string
  label: string
  description: string
  severity: 'hard' | 'soft' | 'conditional'  // NEW
  condition?: string     // "building around k8s is fine, being a k8s admin is not"
}
```

#### Gap 5: Search Strategy Metadata

Belongs in `SearchThesis`, not identity model. Timeline urgency, keyword combinations with noise levels, vector priority rationale.

#### Gap 6: Education Constraints

Degree filtering risk needs a home — `preferences.constraints.education` or `awareness` entry.

#### Gap 7: Title Flexibility

Implicit from `target_roles` breadth across vectors. No schema change needed — thesis generation infers it.

### Summary: Identity Schema Changes Needed

| Gap | Schema Location | Change Type |
|---|---|---|
| Semantic skill depth | `SkillItem.depth` | Extend union type with `expert`, `hands-on-working`, `architectural`, `conceptual` |
| Search signal per skill | `SkillItem.positioning` (reuse) or new field | Consistent population |
| Honest framing / calibration | `SkillGroup.calibration` (new) | New optional field |
| Filter nuance | `MatchingFilter.severity` + `condition` | Extend severity, add condition |
| Education constraint | `preferences.constraints` | New field or awareness entry |

All changes are backward-compatible (new optional fields, extended union types).

---

## Identity Model Lifecycle

The redesign depends on the identity model being both readable (Phase 1 inputs, Phase 2 evidence) and writable (corrections during thesis review, result feedback). Three concerns fall out of this bidirectionality — each of which can silently break the shepherding loop if missed.

### Identity Versioning

The identity model needs a monotonic `version: number` counter that increments on any mutation. This enables:

- **Thesis staleness detection:** `SearchThesis.identityVersion` vs. current `identity.version`
- **Fresh-context critique triggers:** every artifact (thesis, run, cover letter, prep deck) records the identity version it was generated from
- **Cache invalidation** for any derived artifact when the underlying identity changes
- **Feedback round-trip tracking:** `SearchFeedbackEvent.appliedAtVersion` lets us know which events have already been reflected in the identity model

Without versioning, there is no mechanism to detect that a cover letter, thesis, or prep deck was generated against a now-stale identity — the entire "refresh available" UX in doc-26 depends on this counter.

### Writeback Precedence

Corrections flow back into:
- `identity.skills[].depth` (thesis skill-depth corrections)
- `identity.skills.groups[].calibration` (honest-framing corrections)
- `identity.preferences.matching.*.condition` (filter refinements)
- `identity.search_vectors[]` (lane additions/removals)

The AI inference in `identitySearchProfile.ts` (`inferSkillDepth`) runs on profile regeneration — e.g., resume reimport, identity re-adapt — and will overwrite user corrections with its own heuristic.

**Precedence rule: user correction > explicit schema value > AI inference.**

Implementation (pick one):

1. **Provenance flag per field:** `depthSource?: 'inferred' | 'corrected'`. Inference only runs when source is `inferred` or absent.
2. **Immutable-once-set semantics:** inference only fills values when `depth === undefined`. Works for fields that are append-only in practice.

Without an explicit precedence rule, corrections silently vanish on regeneration — breaking the shepherding contract that "correction feels like progress."

### Staleness Detection

Downstream artifacts carry metadata that supports comparison:

```typescript
interface ArtifactMetadata {
  createdAt: string
  identityVersion: number        // Version at generation
  identityFingerprint?: string   // Optional content hash for fine-grained comparison
}
```

When `identity.version > artifact.identityVersion`, the UI surfaces a non-blocking "refresh available" affordance. The fingerprint enables finer-grained staleness: a cover letter only cares if the identity *fields it referenced* changed, not any mutation.

### Feedback Event Schema (Supporting Concept)

```typescript
interface SearchFeedbackEvent {
  id: string
  runId: string
  resultId: string
  rating: 'up' | 'down'
  reason?: string
  dimensions?: {
    skill?: { name: string; suggestedDepth?: string }
    preference?: { category: 'prioritize' | 'avoid'; label: string; condition?: string }
    vector?: { title: string; thesis?: string }
  }
  appliedToIdentity: boolean
  appliedAtVersion?: number          // Which identity version absorbed this event
  reflectedInThesisId?: string       // Which thesis version first incorporated it
  createdAt: string
}
```

`SearchThesis.feedbackIncorporated: string[]` references these event IDs. Aggregation for thesis regeneration = "all events where `appliedToIdentity === true` and `reflectedInThesisId !== current`."

---

## Execution Architecture: Two-Phase Hybrid

### Phase 1: Thesis Generation (Interactive)

A focused API call where the model analyzes the identity model and produces a search thesis. User reviews, corrects, and approves before committing to the expensive search.

**Model:** Opus (claude-opus-4-7)
**Duration:** ~30-90 seconds
**API:** Standard `callLlmProxy()` with extended thinking

```typescript
{
  model: 'opus',
  thinking: { type: 'enabled', budget_tokens: 10000 },
  temperature: 0.3,
  timeoutMs: 120000,
  feature: 'research.thesis'
}
```

**Inputs sent to the model:**
- Full identity model: self_model (arc, philosophy, interview_style), profiles, skills with PAIO bullet context, search_vectors, preferences (interview process, matching, constraints)
- Skill group calibration notes (honest framing)
- Previous search feedback (if any)

**Outputs — the Search Thesis:**
- **Competitive moat statement** — what makes this candidate structurally different
- **Unfair advantage combinations** — rare skill combinations with depth validation
- **Search lanes** — 2-4 strategic angles, each with rationale and competitive context
- **Interview process strategy** — connects candidate archetype to interview format advantage
- **Signal checklist** — what to look for and what to avoid (with qualifying conditions)
- **Keyword combinations** — specific search queries per lane with expected noise level
- **Semantic skill depth map** — AI-inferred depths for user review/correction
- **Timeline strategy** (if urgency set)

**The thesis IS the parameters document**, generated from the identity model.

**UX flow:**
1. System generates thesis (~60s)
2. User sees thesis rendered as editable card/panel
3. User corrects: adjust skill depths, reframe lanes, add/remove signals, add calibration notes
4. Corrections feed back to identity model (with confirmation)
5. User hits "Run Search" → Phase 2 begins
6. Thesis persists in searchStore for reuse

### Phase 2: Deep Research Execution (Async Job + Task Budget)

Phase 2 is executed as an **async job**, not a single long-held HTTP request. The client posts the approved thesis + params; the proxy creates a durable job record and returns a `jobId` immediately. The Anthropic Task Budgets call runs server-side; the client polls for status (or subscribes via SSE when foregrounded). Results persist to storage regardless of whether the client is still connected.

This shape is non-negotiable for a 10-20 minute operation. A single long-held fetch dies on tab close, page reload, network switch, OS-level tab suspension, and any intermediate LB/CDN idle timeout. Async-job makes the run survive all of them.

**Model:** Opus (claude-opus-4-7)
**Duration:** 10-20 minutes expected
**API (runner-side):** Task Budgets beta with web search + extended thinking

#### Job Lifecycle

```
[queued] → [running] → [completed]
                    ↘ [canceled]
                    ↘ [failed]
```

- **queued** — job created, awaiting the runner
- **running** — runner has started the Anthropic call
- **completed** — result persisted; client can fetch via GET
- **canceled** — user aborted; runner propagates cancel upstream
- **failed** — error captured with structured reason; thesis preserved for retry

#### Job Record (Durable)

```typescript
interface ResearchJob {
  id: string
  userId: string
  thesisId: string
  thesisSnapshot: SearchThesis    // Immutable snapshot taken at job creation
  identityVersion: number         // Identity version this job was run against
  params: SearchRequest
  status: 'queued' | 'running' | 'completed' | 'canceled' | 'failed'
  createdAt: string
  startedAt?: string
  completedAt?: string
  progress?: {
    phase: string
    elapsedMs: number
    searchQueries: string[]
    thinkingExcerpts?: string[]
    findingsCount?: number
  }
  result?: {
    narrative: SearchRunNarrative
    results: SearchResultEntry[]
    tokenUsage: SearchTokenUsage
  }
  error?: { code: string; message: string; retriable: boolean }
  ttlAt: string                   // Cleanup timestamp
}
```

#### Endpoints

- `POST /research/jobs` — create a job; returns `{ jobId, status: 'queued' }` immediately
- `GET /research/jobs/:id` — fetch current status + result if complete (polled)
- `GET /research/jobs/:id/stream` — **optional** SSE subscription; emits progress events as the job runs
- `POST /research/jobs/:id/cancel` — request cancellation; runner propagates to Anthropic
- `GET /research/jobs` — list user's recent jobs (for the "my searches" view)

#### Runner-Side Anthropic Call

```typescript
{
  model: 'opus',
  max_tokens: 128000,
  thinking: { type: 'enabled', budget_tokens: 15000 },
  output_config: {
    effort: 'high',
    task_budget: { type: 'tokens', total: 80000 }
  },
  tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 20 }],
  betas: ['task-budgets-2026-03-13'],
  feature: 'research.deep-search'
}
```

**What the model does within the task budget:**
1. Analyzes the thesis and plans search strategy across lanes
2. Executes web searches using keyword combinations
3. Deep-dives into promising companies
4. Applies filter conditions with nuance
5. Writes "Why this candidate wins here" narratives
6. Groups results by signal convergence
7. Produces executive summary, rejected-candidates list, and surprises (see Output Contract below)

#### Client Polling

- Exponential backoff: 2s → 5s → 15s → 30s capped
- Pause polling when tab is hidden (`document.visibilityState`); resume on focus
- On `completed`: hydrate result into `searchStore` and render
- On `failed`: surface error, preserve thesis for retry
- On `canceled`: clear progress UI, preserve thesis

#### Client SSE Subscription (Optional, Degrades Gracefully)

When the tab is foregrounded, the client opens `GET /research/jobs/:id/stream` to receive progressive events:

- `{ type: 'thinking', text }` — model reasoning text as it arrives (for shepherding)
- `{ type: 'search_query', query }` — each web search executed
- `{ type: 'finding', summary }` — intermediate finding blocks
- `{ type: 'status', status }` — lifecycle transitions
- `{ type: 'complete', jobId }` — result ready; client fetches via GET

**SSE is a view into the running job, not the transport for the result.** The result always lands in durable storage. Connection drops are non-fatal — the client reconnects or falls back to polling.

#### Multi-Device and Resume

Because the job lives in durable storage, a user can:
- Start a search on desktop, close the laptop, and see the result from mobile
- Reload the page at any time and rejoin the job
- Receive a browser push notification (or email, if opted in) on completion

#### Cost Guardrails

- Estimated cost preview is shown on the "Run Search" button before job creation ("Typical cost: $5-15")
- Server-side budget check: reject `POST /research/jobs` if the user's recent spend exceeds a per-window cap
- Double-submit guard: returning an existing in-flight `jobId` if thesis + params hash matches
- Token usage is recorded on every run so per-user totals are queryable

### Why Two Phases

| Concern | Why Phase 1 is separate |
|---|---|
| **Cost** | Task budget call is ~$5-15. Validate thesis first. |
| **Correction** | Catch wrong skill depth assumptions before expensive search. |
| **Product philosophy** | Seed → correct → converge. The thesis IS the seed. |
| **Reusability** | Approved thesis can be reused with different parameters. |

### Why Task Budgets

| Concern | Why single task budget wins |
|---|---|
| **Quality** | Model maintains context across entire research loop |
| **Efficiency** | Adaptive effort allocation — more time on promising leads |
| **Simplicity** | One API call vs. 3-4 sequential calls |
| **Closer to reference** | Founder's reports were single deep-research sessions |

### Why Async Job (vs. Single Long-Held Request)

| Concern | Why async wins |
|---|---|
| **Tab close / reload** | Job continues server-side; result persists |
| **Network switches** | Desktop → phone doesn't abort the run |
| **Intermediate timeouts** | No 15-min HTTP connection held across LBs, CDNs, proxies |
| **Retry / partial recovery** | Server captures partial state; retry upstream failures |
| **Cost safety** | Single source of truth for usage; central rate-limiting and budget checks |
| **Observability** | Every run is a durable row with status, tokens, errors |
| **Multi-device** | User can check progress from any session |

---

## Progress & Status During Phase 2

Progress is sourced from the job record, never from an in-flight HTTP connection. The UI has two modes: **polled** (always available) and **SSE-subscribed** (opportunistic, when tab is foregrounded).

### Polled Mode (Baseline)

- Elapsed timer derived from `job.startedAt`
- Status label from `job.status` and `job.progress.phase`
- Activity indicator and "Typical 10-20 min" duration hint
- Cancel button posts to `/research/jobs/:id/cancel`
- Works in any tab state — background tabs still see completion on next poll
- Browser notification on completion via Notification API

### SSE-Subscribed Mode (Shepherding UX)

Opened only when the tab is foregrounded. Streams thinking text, search queries, and finding summaries to the progress panel as they arrive. Closed when the tab is hidden; falls back to polling automatically.

Why this split: the "watch it think" experience is valuable *when the user is watching*, but mandating a live connection would recreate the fragility we're trying to avoid. SSE is additive.

### UI State Machine

```
[Thesis Generated] → User reviewing/editing
    → [Thesis Approved] → User hits "Run Search"
        → [Job Created] → jobId returned, progress panel opens
            → [Polling] ↔ [SSE Subscribed]  (interchangeable based on tab visibility)
                → [Completed] → results hydrate into store, notification fires
                → [Canceled] → thesis preserved, progress panel closes
                → [Failed] → error surfaced with retry affordance, thesis preserved
```

The state machine has only one "working" state from the client's perspective — whether it's getting updates via poll or SSE is an implementation detail. Tab close/reload drops back to the Polling branch seamlessly on re-entry.

### On Reload / Rejoin

When the Research workspace mounts with an in-flight `jobId` in `searchStore`:
1. Fetch `GET /research/jobs/:id` to get current status
2. If still running, resume polling (and optionally open SSE)
3. If completed, hydrate result
4. If failed/canceled, display last-known state

This is what "search continues when user navigates away" actually means — the job runs independent of the client, and any client session can rejoin.

---

## Design: Supporting Concepts

### A. Search Thesis (Type & Storage)

```typescript
interface SearchThesis {
  id: string
  createdAt: string
  updatedAt: string

  competitiveMoat: string
  unfairAdvantages: Array<{
    combination: string
    depth: string
    targetCompanyProfile: string
  }>
  searchLanes: Array<{
    id: string
    title: string
    rationale: string
    competitiveContext?: string
    targetSignals: string[]
  }>
  interviewStrategy: string
  lookFor: string[]
  avoid: Array<{ label: string; condition?: string }>

  timeline?: {
    urgency: 'critical' | 'active' | 'exploratory'
    deadline?: string
    strategyImpact: string
  }
  keywordCombinations: Array<{
    query: string
    lane: string
    noiseLevel: 'low' | 'medium' | 'high'
  }>
  skillDepthMap: Array<{
    skill: string
    depth: string
    context: string
    searchSignal: string
    calibration?: string
  }>

  source: 'generated' | 'user-edited'
  identityVersion: number
  feedbackIncorporated: string[]
}
```

### B. Semantic Skill Depth

Depth levels: `expert` | `strong` | `hands-on-working` | `architectural` | `conceptual` | `basic` | `avoid`

Two mechanisms:
1. AI inference during thesis generation (reads PAIO bullets)
2. User correction → identity model writeback

### C. Feedback Loop

| Signal | User Action | What Updates |
|---|---|---|
| Skill depth | "I don't actually know Rust" | `identity.skills` depth override |
| Calibration | "I'm not a k8s admin" | `identity.skills` group calibration |
| Preference | "I like companies at this stage" | `identity.preferences.matching.prioritize` |
| Vector expansion | "BAS companies are a fit" | `identity.search_vectors` |
| Avoid | "Stop showing fintech" | `identity.preferences.matching.avoid` |
| Thesis refinement | "Builder angle works best" | `searchThesis` lane priorities |
| Result rating | Thumbs up/down + reason | Feedback events → next thesis |

---

## Enriched Result Schema

```typescript
interface SearchResultEntry {
  // Existing fields ...
  id: string; tier: 1 | 2 | 3; company: string; title: string; url: string
  location?: string; matchScore: number; matchReason: string
  vectorAlignment: string; risks: string[]; estimatedComp?: string; source: string

  // NEW
  candidateEdge: string              // "Why this candidate wins here" — 2-4 sentence narrative
  interviewProcess?: {
    format: string
    builderFriendly: boolean
    aiToolsAllowed: boolean
    estimatedTimeline?: string
  }
  companyIntel?: {
    stage: string
    aiCulture: string
    remotePolicy: string
    openRoleCount?: number
  }
  signalGroup?: string               // "every signal aligns" | "most signals converge" | etc.
  advantageMatch?: string             // which unfair advantage combination drove this
}
```

### Tier vs. signalGroup: Relationship

Both `tier` (1 | 2 | 3) and `signalGroup` (string, e.g. "every signal aligns") communicate match quality. To prevent the user from reconciling two taxonomies:

- **`signalGroup` is canonical** — it's the expressive, user-facing grouping the model produces and the UI renders as section headers in the new design
- **`tier` derives from `signalGroup`** via a documented mapping, maintained for backward compatibility with pipeline entries, existing result-list sorting, and the `tier` field on `PipelineEntry`
- **Default mapping** (implemented in `normalizeResults` post-processing):
  - `"every signal aligns"` → tier 1
  - `"most signals converge"` → tier 2
  - `"some signal alignment"` or any other group → tier 3
- **Deprecation path** — new UI surfaces render `signalGroup`; legacy surfaces continue to consume `tier`. Do not display both simultaneously in the same UI region.

The model is instructed to produce `signalGroup` as the primary quality signal; `tier` is a derived field, not a separately-generated one. Eliminating the model's need to maintain both reduces the risk of them disagreeing.

---

## Output Contract: Reasoning Layers

The model's reasoning must be surfaced in multiple structured layers — not just as per-result fragments. The schema and prompt contract must be designed together: if a field is labeled terse, the model will keep it terse. Models ruthlessly minimize response length against inferred schema granularity, so the prompt must explicitly demand prose where prose is needed.

### Layer 1: Run-level narrative (5-layer structure)

Reference analysis of `backlog/reference files/Where Builders Beat Leetcoders_.pdf` and `Platform and Security Platform Job Search Report.pdf` revealed that reference search outputs have five distinct narrative layers, not two. The earlier two-layer design (`executiveSummary + searchApproach`) is too compressed — the references open with moat + methodology + market context, lane-group the results, then close with trends + objective recommendations + an application plan.

```typescript
interface SearchRunNarrative {
  // Opening layers (the argument before results)
  competitiveMoat: string              // What makes the candidate structurally different
  selectionMethodology: string         // How the shortlist was filtered (criteria + sources)
  marketContext: string                // Landscape paragraph with citations
  scoringRubric?: string[]             // How match scores were computed (transparency)

  // Lane structure
  laneSummaries?: Array<{ lane, narrative, topCompanies }>

  // Closing layers (synthesis after results)
  landscapeTrends?: string             // Market-shift paragraph with citations
  objectiveRecommendations?: Array<{   // "For X optimize for these; for Y those"
    objective: string
    recommendedCompanies: string[]
    rationale: string
  }>
  applicationPlan?: ApplicationPlan    // Gantt-style dated phases, tied to SearchTimeline
  visualizations?: Array<{             // Mermaid source — Gantt, xychart, etc.
    type: string
    source: string
    caption?: string
  }>

  // Top-of-output summary
  executiveSummary: string             // Compression of everything above

  // Feedback surfaces
  surprises?: string[]
  rejectedCandidates?: Array<{ company, reason }>
  nextSteps?: string[]
  references?: Array<{ id, url, title? }>

  // Transparency (TASK-185)
  assumptions?: SearchAssumption[]     // What the search filled when inputs were ambiguous
}
```

`rejectedCandidates` remains the sleeper field — it turns search output from a list into a defensible argument. `assumptions[]` is the transparency sibling — it surfaces what the search inferred when the input was ambiguous, turning silent gap-filling into a correctable surface. Both are covered by TASK-160 (types) and TASK-185 (assumptions).

### Layer 2: Thesis-level narrative

`SearchThesis` gets a `narrative: string` field — a 3-5 paragraph cohesive explanation that weaves moat → advantages → lanes → signals into a single story the user can read top-to-bottom. Without this, the thesis is a structured dataset but not a coherent *argument*. And users evaluate whether to spend $5-15 on Phase 2 by reading that argument.

```typescript
interface SearchThesis {
  // ...existing fields...
  narrative: string   // Cohesive strategic explanation connecting all fragments
}
```

### Layer 3: Per-result narrative

`SearchResultEntry.candidateEdge` must be 2-4 sentences of prose following the reference formula:

- **Candidate fact** — a specific achievement, skill combination, or metric
- **Company fact** — what this specific company does / needs
- **Interpretation** — why the overlap is a match, not just a similarity

When `SearchRequest.resumeVariants` is set (TASK-183), per-result output also includes directive prescriptions:

```typescript
interface SearchResultEntry {
  // existing...
  candidateEdge: string              // 2-4 sentence narrative
  edge?: string                      // Compressed one-line variant (some refs use both)
  keyRequirements?: string[]         // Compressed phrases from the posting
  caveat?: string                    // Freshness/hiring-pause warning

  // Directives (paste-ready content for the candidate)
  recommendedVariant?: string        // Which resume variant to use
  bulletEdits?: Array<{              // 3 bullets: 1 lead + 2 supporting
    emphasis: 'lead' | 'supporting'
    text: string                     // Full resume bullet, first-person past-tense, with metrics
    rationale?: string
  }>
  keywordsToInclude?: string[]       // 8-12 posting-specific phrases to weave in

  // Enrichment
  openRoles?: Array<{ title, compRange?, notes? }>
  companyIntel?: {                   // 6+ field grid
    whatTheyDo, scale, stage, team?, aiCulture, remotePolicy, openRoleCount?
  }
  interviewProcess?: { format, narrative?, builderFriendly, aiToolsAllowed, estimatedTimeline? }

  // Citations (TASK-184)
  citations?: Citation[]             // [cite:<id>] markers in prose resolve here
}
```

The directive fields (`bulletEdits`, `keywordsToInclude`) are what make search results actionable rather than informational — references like the Platform/Security Job Search Report include paste-ready resume bullet rewrites per top match. TASK-183 covers this.

### Layer 4: Internal thinking (extended thinking blocks)

Extended thinking is enabled for both phases (`thinking: { type: 'enabled' }`) but the thinking content is not persisted to the final artifact. Policy:

- **Phase 1:** thinking text streamed into the thesis-generation progress UI for transparency; discarded once the thesis renders
- **Phase 2:** thinking text surfaced via SSE `{ type: 'thinking' }` events for shepherding during the wait; not persisted to `ResearchJob.result`

This keeps the artifact small and reviewable while still delivering the "watch it think" shepherding UX during generation.

### Prompt Output Contract (Required in Both Phases)

Every generation prompt includes explicit output-contract instructions — not just a JSON schema:

> Your response must include:
>
> **Run-level narrative (5 layers, see SearchRunNarrative):**
> 1. `competitiveMoat` — what makes this candidate structurally different (paragraph)
> 2. `selectionMethodology` — how the shortlist was filtered, including sources and criteria (paragraph)
> 3. `marketContext` — landscape paragraph citing broader trends relevant to this search
> 4. `executiveSummary` — 3-5 sentence compression of the above
> 5. `landscapeTrends` — market-shift paragraph closing the run (optional but expected for comprehensive searches)
>
> **Run-level synthesis:**
> 6. `laneSummaries[]` — per-lane narrative with lead companies (for lane-grouped reports)
> 7. `objectiveRecommendations[]` — "for X optimize for these; for Y those"
> 8. `applicationPlan` — Gantt-style dated phases tied to timeline deadline (when `SearchTimeline.deadline` is set)
> 9. `visualizations[]` — Mermaid source for Gantt, xychart, or other diagrams (when helpful)
>
> **Run-level transparency:**
> 10. `assumptions[]` — every gap-filled input, listed with claim + rationale + confidence
> 11. `surprises[]` — observations that should feed back
> 12. `rejectedCandidates[]` — companies evaluated but cut, with reason
> 13. `nextSteps[]` — suggested follow-up actions
> 14. `references[]` — resolved citation URLs (for numbered-footnote mode)
>
> **Per-result core:**
> 15. `candidateEdge` — 2-4 sentence narrative using candidate-fact + company-fact + interpretation formula
> 16. `openRoles[]`, `companyIntel` (whatTheyDo, scale, stage, team, aiCulture narrative, remotePolicy, openRoleCount?)
> 17. `interviewProcess` with narrative flow (not just booleans)
> 18. `edge` — one-line compressed variant (optional)
> 19. `keyRequirements[]` — compressed posting phrases
> 20. `caveat?` — freshness/hiring-pause warning when applicable
>
> **Per-result directives (when `SearchRequest.resumeVariants` is set):**
> 21. `recommendedVariant` — variant id
> 22. `bulletEdits[]` — 3 bullets (1 lead + 2 supporting), full first-person past-tense text with metrics, under 30 words each
> 23. `keywordsToInclude[]` — 8-12 posting-specific phrases
>
> **Citations (required):**
> 24. Every factual claim (interview process, compensation, company size, team structure, hiring status, policies, funding) is attributed via `[cite:<id>]` inline markers
> 25. `citations[]` contains all referenced sources with id, source, url, type
> 26. Do not make claims you cannot cite
>
> **Universal rule:** Do not collapse reasoning into fragments. Fields labeled "narrative" or "summary" expect prose. Fields labeled "edge" or "reason" expect 2-4 sentences. Structured output does not mean terse output.

Without this contract, the model compresses to fragments, skips citations, and the "why this works" layer evaporates.

### Where the Contract Lives

- **Phase 1 output contract:** enforced in the thesis-generator system prompt (task-151.1). Output validation asserts `narrative.length >= N`, each `SearchLane.rationale` is more than a phrase, etc.
- **Phase 2 output contract:** enforced in the deep-research runner prompt (task-151.2). Output validation asserts `executiveSummary` and `searchApproach` exist and meet minimum lengths; each `SearchResultEntry.candidateEdge` is at least 2 sentences.
- **Graceful degradation:** if the model returns a fragment where prose was required, render the fragment but surface a "regenerate" affordance and log the violation to telemetry.

---

## Implementation Sequence

**Foundation (M1 — Foundation Types)**
1. **Identity schema extensions** — richer depth levels, `calibration` on skill groups, `condition` on filters (shipped, task-150)
2. **Search thesis + enriched result types** — `SearchThesis`, enriched `SearchResultEntry` (shipped, task-152)
3. **Narrative type extensions** — `SearchRunNarrative`, `SearchThesis.narrative`, `ResearchJob` types (task-160)
4. **Identity versioning** — `identity.version` counter, depth provenance flag, staleness detection helpers (task-159)
5. **Feedback event schema** — `SearchFeedbackEvent` type and storage contract (task-163)

**Proxy / Infrastructure (M2)**
6. **Parameter pass-through** — `output_config`, `betas`, higher `max_tokens` (task-153)
7. **Async job infrastructure** — durable `ResearchJob` storage, `POST/GET/cancel` endpoints, runner lifecycle, cost guardrails (task-161, task-164)
8. **SSE subscription endpoint** — optional `GET /research/jobs/:id/stream` passthrough (task-162)

**Search Thesis (M4)**
9. **Thesis generation engine** — Phase 1 API call with output contract (archetype, PAIO, calibration, preferences) (task-151.1)
10. **Thesis editor UI** — read-only renderer, inline correction, lane/keyword CRUD, identity writeback with precedence rules (task-151.1)

**Deep Research (M5)**
11. **Deep research execution** — client consumes async job API; prompt is thesis + identity evidence (not thesis alone); enforces reasoning output contract (task-151.2)
12. **Progress UI** — polling + optional SSE subscription, background execution, cancel, rejoin on reload, browser notification (task-151.2)

**Pipeline Flow (M6)**
13. **Search→pipeline mapping** — enrich `createPipelineEntryDraft()` to map new fields (task-151.3)
14. **Feedback loop** — result-level actions, feedback event storage, identity writeback with confirmation (task-151.3)
15. **Thesis persistence and evolution** — version-aware reuse, regeneration triggers, snapshot-on-run (task-151.3)

---

## Proxy Changes Required

### Parameter Pass-through (Used by Phase 1 and the Phase 2 Runner)

| Parameter | Current | Needed |
|---|---|---|
| `model: 'opus'` | ✅ | — |
| `thinking_budget` | ✅ | — |
| `tools` (web_search) | ✅ | Update type version to `web_search_20260209` |
| `max_tokens: 128000` | ❓ | Increase cap for `research.deep-search` feature key |
| `output_config.task_budget` | ❌ | Pass through to Anthropic body |
| `output_config.effort` | ❌ | Pass through to Anthropic body |
| `betas` header | ❌ | Pass `anthropic-beta` header (joined from client `betas[]`) |

### Async Job Infrastructure (New)

| Capability | Needed |
|---|---|
| Durable job storage | Per-user `ResearchJob` records with TTL (Cloudflare Durable Object, D1, KV, or equivalent) |
| Job runner | Long-running execution environment that can hold a Task Budgets call for 10-20 minutes (Durable Object, worker, or dedicated process) |
| `POST /research/jobs` | Create job, enqueue runner, return `jobId` immediately |
| `GET /research/jobs/:id` | Status + result fetch (auth-scoped to user) |
| `POST /research/jobs/:id/cancel` | Cancellation signal; runner aborts upstream |
| `GET /research/jobs` | List current user's recent jobs |
| `GET /research/jobs/:id/stream` | Optional SSE subscription; passes through runner events |
| Heartbeat / liveness | Runner writes progress updates on a cadence so orphan jobs are detectable |
| Cleanup | TTL-driven removal of completed/failed jobs after N days |
| Auth scoping | `userId` match between session and job record on every read |

---

## Key Risks

- **Task Budgets is beta** — design proxy passthrough generically so beta name changes don't break the client
- **Cost per search** — ~$5-15 per deep search. Mitigated by estimated cost preview, per-user budget ceiling, and double-submit guard
- **Job runner reliability** — a runner that dies mid-execution can orphan a job; need heartbeat, retry, and partial-state capture
- **Durable job storage hygiene** — needs TTL, cleanup job, cross-user auth isolation on every read
- **SSE connection fragility** — acceptable because SSE is a view, not the transport; job result always lands in storage
- **Identity writeback precedence** — user-corrected depth must not be overwritten by AI inference on identity regeneration (see Identity Model Lifecycle section)
- **Thesis staleness detection** — requires `identity.version` counter; without it, fresh-context critique triggers can't fire
- **Output contract enforcement** — models collapse reasoning to fragments unless prompts explicitly demand prose (see Output Contract: Reasoning Layers)
- **Web search freshness** — results should be timestamped, treated as perishable
- **Identity schema migration** — new depth levels/fields need migration logic (shipped in task-150; schema is backward-compatible)

---

## Reference Material

- `Pipeline Tracker.html` — manual pipeline tracker with 23 entries, full process tracking (positioning, skill match, interview format, rejection tracking, resume variant). `PipelineEntry` is a near-exact match.
- `Job Search Parameters.html` — ideal search input: 60+ skills with semantic depth/context/search signal, 5 vectors with priority rationale, include/exclude filters with conditions, interview criteria, honest framing notes, keyword combos with noise levels
- `Platform and Security Platform Job Search Report.pdf` — structured search output: executive summary, search approach, match scoring, ranked shortlist
- `Where Builders Beat Leetcoders.pdf` — thesis-driven search output: competitive moat → signal-grouped results with "Why this candidate wins here" narratives
- Current implementation: `src/utils/searchExecutor.ts`, `src/utils/identitySearchProfile.ts`, `src/identity/schema.ts`, `src/types/pipeline.ts`, `src/routes/research/ResearchPage.tsx`
- Product philosophy (backlog doc-21): extraction is the bottleneck, correction > creation, seed → correct → converge
- Proxy: `src/utils/llmProxy.ts`, `src/utils/searchExecutor.ts`
- Anthropic API: Task Budgets beta (`task-budgets-2026-03-13`), Extended Thinking, Web Search Tool
