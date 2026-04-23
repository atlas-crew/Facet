---
id: doc-28
title: >-
  Prep Workspace Structural Additions — Interviewer Intel, Card Kinds, Scenario
  Shapes
type: other
created_date: '2026-04-23 05:40'
---
# Prep Workspace Structural Additions — Interviewer Intel, Card Kinds, Scenario Shapes

**Status:** Plan / schema proposal
**Relates to:** doc-25 (Prep Workspace Gap Analysis — Strategy Layer & Round Progression)
**Scope:** Structural / schema additions to `src/types/prep.ts` and downstream renderers + generator prompts

---

## Context & Source Artifacts

Two recent Prep artifacts were produced for the Updater job search and go meaningfully beyond what the current Facet Prep workspace can represent structurally:

- **`/Users/nick/Downloads/updater-panel-prep_2.html`** — Panel round prep for Andrew Regan (Manager, Production Support), Chandeka Ork (Sr TPM II, Delivery Ops & Engineering), and Annie Lin (Sr Manager, Data Engineering). Each interviewer has their own intel card and a personalized "line that lands" tuned to their specific background and concerns.
- **`/Users/nick/Downloads/updater-doug-prep_1.html`** — Deep technical round prep for Doug Roccato (Manager, DevOps). Organized around one anchor story (ThreatX Platform Rebuild, 8-min budget) with five nested sub-decision cards, plus dedicated scenario cards with decision trees.

Both artifacts are the same Prep product, but they are clearly *interviewer-tuned* rather than just role-tuned. The user's comment on how they were produced: **"the model did all of the research for me, i just told the model the names and the format"** — meaning the tuning came from public signals (LinkedIn, GitHub) combined with structure the user imposed via the prompt. That structure is what this doc proposes to lift into the schema.

The two artifacts also live in the basic-memory vault under `facet/main/ref-materials`, mirrored for future reference (vault is the authoritative personal copy; the Downloads copies may be cleaned up).

---

## Relation to doc-25

doc-25 ("Prep Workspace Gap Analysis — Strategy Layer & Round Progression") already covers:

- Meta-strategy layer (why the round exists, what winning looks like)
- Framing notes and transitions
- **Named interviewer intel as prompt-only now, structured later**
- Competitive positioning
- Time budgets per section / per card
- Round progression across multi-round loops

doc-25 explicitly flagged interviewer intel as "structured later." The Updater artifacts are the evidence that *structured is now warranted* — three named interviewers per panel, each with distinct concerns, each deserving a distinct line-that-lands, is not something prompt-only can produce reproducibly.

**doc-25 remains authoritative for the strategy / meta-coaching layer.** This doc is additive and lives adjacent to it, focused on the structural / schema layer that the Updater artifacts now justify.

---

## New Patterns Observed (not yet in doc-25)

### 1. Per-Interviewer Intel Grid

The Panel artifact dedicates a full card per interviewer with a consistent structured grid:

- **Role / Title**
- **Stack / Background**
- **What they care about**
- **Your angle**
- **Key Tell** (the thing they'll listen for)
- **LinkedIn Positioning**
- **Education**

And a separate, highly-tuned one-liner — **"Line that lands for \[name\]"** — that references their specific concern. Examples from the Panel artifact:

- For **Andrew Regan** (Manager, Production Support — owns on-call): *"I have real empathy for on-call burden. 'You build it you run it' looks clean on a slide and feels rough at 3am on a Tuesday. Platform exists to reduce that burden, not add to it — which means runbooks, observability, and shift-left docs aren't afterthoughts, they're core platform output."*
- For **Chandeka Ork** (Sr TPM II, Delivery Ops & Engineering — delivery-coordination voice): *"Platform work is interrupt-driven by nature. I manage it by being ruthless about what goes on the roadmap — only the things that compound. Day-to-day interrupts get handled and captured. The goal is no surprises: partners know what's coming, what's shipped, and what I said no to."*
- For **Annie Lin** (Sr Manager, Data Engineering — pod lead whose team the platform would serve): *"My first month in any platform role isn't shipping anything — it's sitting with the pod leads. What are you running, what's painful, what's invisible? You'll know better than I will what would help. My job is building what you'd pull in, not what I think should exist."*

Current `PrepDeck` has no notion of a named interviewer as a first-class entity. Stories/cards can't be routed to a specific person. The "line that lands" move has no home.

### 2. Card Kind Axis

Both artifacts use HTML section tags that are structurally orthogonal to the topical category:

`tag-opener`, `tag-intel`, `tag-design`, `tag-technical`, `tag-danger`, `tag-reference`, `tag-behavioral`

A **Scenario** card is not laid out the same way as a **Story** card, which is not laid out the same way as an **Intel** card. The existing `PrepCategory` (opener / behavioral / technical / project / metrics / situational) is **topical** — "what domain is this about." The artifacts use a second axis — **kind** — which is "what shape is this card." A technical scenario card and a technical anchor story share `category: 'technical'` but should render and prompt differently.

### 3. Anchor Story with Nested Sub-Decisions

Doug's artifact is organized around a single anchor: **ThreatX Platform Rebuild** with an 8-minute budget. Inside the anchor are five sub-decision cards, each its own mini-STAR:

1. **Flux over Argo CD** (GitOps — pull-model + Kustomize-native fit the team shape)
2. **Terragrunt over raw Terraform** (IaC — DRY across dev/staging/prod + per-tenant stacks)
3. **Kafka/MSK as Protective Buffer** (Architecture — event-sourcing in front of a saturating Postgres)
4. **VPC Consolidation — $60K/mo saved** (Cost — shared Fargate + connection-based scaling, ~50% reduction)
5. **SOC-to-SRE Handoff** (Team — plugin-architecture CLI that SOC engineers extended into owning the platform)

Each sub-decision has its own **problem / solution / result** blocks *and* two prepared blocks the current schema has no slot for:

- **"If Doug pushes"** — the anticipated pushback and the prepared response
- **"The honest tradeoff"** — the acknowledged cost of the choice

This is the right shape for any senior-level technical deep-dive: one unifying narrative, many defensible sub-stories the interviewer can probe in any order.

### 4. Scenario Decision Trees

The Doug artifact includes scenario cards structured very consistently:

- **Why this scenario is likely** — grounded in the interviewer's background / the company's current state
- **Option table** — columns: Option | When Right | Tradeoff (e.g., Flux vs. Argo vs. Spinnaker, or RabbitMQ vs. Kafka vs. SQS)
- **What I'd pick** — the recommendation with reasoning
- **Trap warnings** — the wrong answer and why it's wrong

The Datadog phased-rollout card is a variant of this: a **Phase 1 / Phase 2 / Phase 3 / Phase 4** framework with timeframes and bullets per phase. It's the same structural shape — here's a decision, here are the options *over time* instead of *side-by-side*.

### 5. Script Kind Variants

The artifacts distinguish at least four distinct rhetorical moves all of which currently collapse into `PrepCard.script` (single free-form string):

- **Opener** — how you enter the conversation
- **Honest-bridge** — the senior-level move of naming a gap and reframing it as transferable
- **Closer** — how you hand off / close the section
- **Line-that-lands** — the interviewer-tuned one-liner

The **honest bridge** is worth calling out as a reusable pattern. From the Doug artifact:

> *"I want to be direct — my production observability experience is Prometheus and Grafana, not Datadog specifically. The patterns transfer cleanly: metrics schema, cardinality discipline, dashboard layering, SLOs, alert routing. Datadog has better out-of-box APM and some nice correlation features. If you're asking me to design the rollout, I'll walk through how I'd approach it; if you want the nuances of specific Datadog integrations I'd be faking it."*

That's a characteristic senior move — name the gap, assert the transferable abstraction, commit to a ramp timeline. It's common enough to deserve its own `scriptKind` so renderers can style it and generators can emit it deliberately.

---

## Proposed Schema Changes

All changes are against `src/types/prep.ts`. Facet is pre-launch (per project `CLAUDE.md`: "pre-launch without users. You do not have to worry about backwards compatibility") — breaking moves are fine where they produce a cleaner shape.

### Change 1: `PrepInterviewer` entity

```ts
export interface PrepInterviewer {
  id: string
  name: string
  title?: string
  linkedInUrl?: string
  intel: {
    role?: string
    background?: string
    stack?: string
    caresAbout?: string
    yourAngle?: string
    keyTell?: string
    linkedInPositioning?: string
    education?: string
  }
  lineThatLands?: string
}

// Additions:
// PrepDeck.interviewers?: PrepInterviewer[]
// PrepCard.interviewerIds?: string[]   // which interviewer(s) this card targets
```

**Why:** Enables per-person story routing and the high-value "line that lands" one-liner. A panel round can now ship with one intel card per person plus stories tagged with which interviewer they're optimized for. Scales naturally — a round with one interviewer just has one entry in `deck.interviewers`. Backwards-compatible: optional fields, absence means same behavior as today.

### Change 2: `PrepCard.kind` — discriminated union discriminator

```ts
export type PrepCardKind =
  | 'opener'
  | 'intel'
  | 'story'
  | 'anchor'
  | 'scenario'
  | 'deep-dive'
  | 'closer'
  | 'reference'
  | 'followup-qa'

export const PREP_CARD_KIND_VALUES = [
  'opener', 'intel', 'story', 'anchor',
  'scenario', 'deep-dive', 'closer',
  'reference', 'followup-qa',
] as const satisfies readonly PrepCardKind[]

// `kind` is the discriminator for PrepCard (see Change 3). It is required
// on every card — no 'freeform' escape hatch. Every card must declare its
// shape explicitly, which forces generators (AI or manual) to commit to a
// layout rather than dumping content into a generic container.
```

**Why:** Unlocks **dedicated renderers** (the Scenario card looks nothing like the Anchor card) and **dedicated AI prompts per card shape** (we can ask the model to emit a scenario card differently than an anchor). `category` stays as the *topical* axis (opener / behavioral / technical / project / metrics / situational); `kind` is the *structural* axis. The two axes are orthogonal — a `category: 'technical'` card can be `kind: 'scenario'` or `kind: 'anchor'` with very different rendering.

Pre-launch means no migration path is needed — every existing card can be hand-assigned a kind in the refactor commit. A one-time derivation from `category` is a convenience for the refactor, not a runtime fallback.

### Change 3: `PrepCard` as a discriminated union

The old shape — one flat `PrepCard` with optional fields for every possible shape — is replaced by a discriminated union keyed on `kind`. Every kind gets its own interface; shared fields live on `PrepCardBase`.

```ts
export interface PrepCardBase {
  id: string
  deckId?: string
  category: PrepCategory
  title: string
  tags: string[]
  timeBudgetMinutes?: number
  notes?: string
  warning?: string
  source?: 'ai' | 'manual' | 'imported'
  company?: string
  role?: string
  vectorId?: string
  pipelineEntryId?: string | null
  updatedAt?: string
  interviewerIds?: string[]
  perRoundState?: PrepCardRoundState[]
  // Script fields available on any kind that carries one:
  script?: string
  scriptLabel?: string      // user-facing display text ("First 60 Seconds")
  scriptKind?: PrepScriptKind // enum for renderer styling + generator routing
}

export interface PrepIntelCard extends PrepCardBase {
  kind: 'intel'
  // interviewerIds expected to contain exactly one id; enforced at
  // boundaries, not in the type (tuple type costs more than it gives).
}

export interface PrepScenarioCard extends PrepCardBase {
  kind: 'scenario'
  whyLikely: string
  decisionTree?: PrepDecisionTreeNode[]
  phasedFramework?: PrepPhasedFrameworkPhase[]
}

export interface PrepAnchorCard extends PrepCardBase {
  kind: 'anchor'
  storyBlocks: PrepStoryBlock[]         // the umbrella narrative
  subDecisions: PrepAnchorSubDecision[] // see Change 4
}

export interface PrepStoryCard extends PrepCardBase {
  kind: 'story'
  storyBlocks: PrepStoryBlock[]
  followUps?: PrepFollowUp[]
  deepDives?: PrepDeepDive[]
  conditionals?: PrepConditional[]
  metrics?: PrepMetric[]
}

// Analogous interfaces for 'opener' | 'closer' | 'deep-dive'
// | 'reference' | 'followup-qa' — each collects only the fields
// that shape actually uses, keeping the base interface lean.

export type PrepCard =
  | PrepIntelCard
  | PrepScenarioCard
  | PrepAnchorCard
  | PrepStoryCard
  | PrepOpenerCard
  | PrepCloserCard
  | PrepDeepDiveCard
  | PrepReferenceCard
  | PrepFollowUpQACard

// Type guards (one per kind) keep call sites readable:
export function isScenarioCard(c: PrepCard): c is PrepScenarioCard {
  return c.kind === 'scenario'
}
// ...etc for each kind

// Supporting types referenced above:
export interface PrepDecisionTreeNode {
  title: string
  options?: Array<{ option: string; whenRight: string; tradeoff: string }>
  recommendation?: string
  trap?: string
}

export interface PrepPhasedFrameworkPhase {
  phase: string
  timeframe?: string
  bullets: string[]
}
```

**Why a discriminated union (rather than one flat interface with optional fields):**

- **Compiler enforces the shape.** A function that receives `PrepScenarioCard` has guaranteed access to `whyLikely` without a null check; a function that receives `PrepAnchorCard` has guaranteed access to `subDecisions`. Optional-fields-on-a-flat-type loses this.
- **Renderers fan out cleanly.** `PrepCardView` dispatches on `card.kind` to a dedicated renderer per shape, with TypeScript narrowing doing the verification. Today's big switch/if-chain over optional fields shrinks to a `match`-style dispatch.
- **Generator prompts can be typed per shape.** When `prepGenerator.ts` builds a scenario card, the builder produces a `PrepScenarioCard` and the type system prevents accidentally returning anchor-only fields. Prompt templates mirror this one-per-kind.
- **Future kinds are additive.** Adding a kind is a new interface + new union member + new renderer branch — existing union members don't change.

The main cost is the lack of a single catch-all shape. That's the feature, not the bug — every card must declare a kind, and the motivation for each kind's extra fields is covered in "New Patterns Observed" above.

### Change 4: `PrepAnchorSubDecision` nested type

Referenced by `PrepAnchorCard.subDecisions` (Change 3). Required (not optional) on anchor cards — an anchor without sub-decisions is just a story.

```ts
export interface PrepAnchorSubDecision {
  id: string
  title: string              // e.g., "Flux over Argo CD"
  tag?: string               // e.g., 'GitOps', 'IaC', 'Architecture', 'Cost', 'Team'
  blocks: PrepStoryBlock[]   // reuse existing problem/solution/result/closer/note shape
  pushbackResponse?: string  // "If [they] push" — the prepared counter
  honestTradeoff?: string    // acknowledged cost of the choice
}
```

**Why:** One anchor narrative, many defensible sub-stories. The interviewer can probe any sub-decision and the candidate has a prepared STAR for it, plus a prepared response to the obvious pushback, plus an acknowledged tradeoff (which is what makes senior candidates sound senior — they don't defend the decision as flawless).

Reusing `PrepStoryBlock` keeps the existing renderer logic composable: a sub-decision renders like a compressed card.

### Change 5: Script kind + deck bookends

`scriptKind` is declared on `PrepCardBase` (Change 3). The enum:

```ts
export type PrepScriptKind =
  | 'opener'           // how you enter the conversation
  | 'honest-bridge'    // name a gap, assert a transferable abstraction
  | 'closer'           // end-of-section / end-of-round
  | 'line-that-lands'  // interviewer-tuned one-liner (pairs with card.interviewerIds)
  | 'pivot'            // transition between topics

// `scriptLabel` (existing field) is retained as user-facing display text —
// e.g., "First 60 Seconds", "Open With", "Line that lands for Andrew".
// `scriptKind` is for code (renderers style by it, generators emit by it);
// `scriptLabel` is for the user's eyes (prose that can be round- or
// interviewer-specific).

// Additions to PrepDeck:
// openerCardId?: string
// closerCardId?: string
```

**Why:** Deck bookends let Live Mode always start at the opener and end at the closer without the user having to remember to drag them into position. `scriptKind` lets the renderer style by rhetorical function — opener scripts get different visual weight than honest-bridge scripts. Generators emit script text *deliberately per kind* instead of producing undifferentiated "script" prose. The label/kind split mirrors the `category`/`kind` split: one is display text, one is structural enum.

### Change 6: Deck-scoped section taxonomy

```ts
export interface PrepDeckSection {
  id: string
  title: string          // "Strategy", "Panel", "Stories", "Deep Dives", "Scenarios"
  cardIds: string[]
}

// Addition to PrepDeck:
// sections?: PrepDeckSection[]
// PrepCard gets no new field — membership is declared deck-side.
```

**Why:** The Panel round uses different sidebar groups than the Technical round. The Panel artifact wants a "Panel" section with one card per interviewer; the Doug artifact wants "Anchor" and "Scenarios" as top-level sections. Hardcoded groups (Intel / Openers / Core / Technical / Tactical) don't fit every round shape. Declaring sections on the deck keeps cards single-owner (a card belongs to one section) and keeps ordering explicit via `cardIds`.

Absence falls back to today's behavior (category-based grouping), which keeps this purely additive.

---

## Implementation Sequencing

### Phase 1 — Interviewer Intel (schema + renderer + prompt)

**Highest user-visible ROI.** Adds `PrepInterviewer`, `deck.interviewers[]`, `card.interviewerIds[]`, plus an intel-card renderer that matches the Panel artifact's grid layout. Extends the prompt in `prepGenerator.ts` to populate the grid + line-that-lands from company research text when interviewer names are supplied.

**Blast radius:** `src/types/prep.ts`, `src/routes/prep/PrepCardView.tsx` (new intel renderer), `src/utils/prepGenerator.ts` (prompt).

### Phase 2 — Kind-aware generation + Scenario & Anchor renderers (combined)

Introduces the discriminated union (Change 3): `PrepCardKind` enum, `PrepCardBase`, per-kind interfaces, type guards. Adds two dedicated renderers in the same phase — Scenario (with `whyLikely` + decision-tree table + phased framework) and Anchor (with umbrella narrative + `subDecisions`, including `pushbackResponse` and `honestTradeoff`).

Combined because they share the same foundation work: without the `kind` axis neither renderer has a dispatcher to hook into, and the generator prompt upgrade ("emit the right kind deliberately") pays off once across both card types. Splitting them would duplicate prompt-plumbing work and require two rounds of PrepCardView refactoring.

**Blast radius:** `src/types/prep.ts` (union + per-kind interfaces), `src/routes/prep/PrepCardView.tsx` (dispatch on kind, two new renderer branches), `src/utils/prepGenerator.ts` (kind-aware generation, scenario + anchor sub-prompts).

### Phase 3 — Script kind, deck bookends, deck sections

Polish layer. `scriptKind` for styling; `openerCardId` / `closerCardId` for Live Mode navigation; `sections` for sidebar grouping. Doesn't block Phase 1–2 and can ship whenever.

**Blast radius:** `src/types/prep.ts`, Live Mode navigation, sidebar component.

---

## Backwards Compatibility

Facet is pre-launch (per `CLAUDE.md`: "no users yet"). We can do breaking schema moves without migrations. Legacy fields should be retained *only if* keeping them simplifies the refactor — not for compat alone.

The `category` field stays as-is. `kind` is required on every card (discriminator for the union). Fields required on their respective variants: `whyLikely` on `PrepScenarioCard`; `storyBlocks` + `subDecisions` on `PrepAnchorCard`; `storyBlocks` on `PrepStoryCard`. Everything else — `interviewers`, `sections`, `decisionTree`, `phasedFramework`, `scriptKind`, `scriptLabel`, `openerCardId`, `closerCardId` — is optional.

If any existing test fixtures hardcode `PrepCard` shape, update them in the same commit as the schema change — do not keep dual shapes.

---

## AI Generation Implications

`src/utils/prepGenerator.ts` is where most of the weight lands. It must be updated to:

- **Populate `PrepInterviewer` records** from company research when interviewer names are present in the generation request (today the prompt already has `pipelineEntryContext.research.people` — that becomes the seed).
- **Emit the "line that lands"** for each interviewer, grounded concretely in their `caresAbout` (no generic platitudes; it must reference a specific observed concern).
- **Choose card `kind` deliberately** during generation instead of only choosing `category`. Different kinds warrant different generation sub-prompts.
- **Emit scenario cards with decision trees** for system-design rounds — the option table (Option | When Right | Tradeoff) is the target shape, not generic prose.
- **Emit one anchor card per technical round**, with three to five sub-decisions, each with its own problem/solution/result + pushbackResponse + honestTradeoff.
- **Emit `scriptKind`-aware scripts** — specifically, the honest-bridge move should be an emittable pattern when the stack-alignment row shows a gap.

**This is a prompt-engineering project of similar scale to the schema changes.** Flag explicitly: the schema changes alone don't produce the Updater-quality output — the generator prompt has to be rewritten to match the new affordances. Plan for schema and prompt work to ship together within each phase, not sequentially.

---

## References

- **doc-25** — Prep Workspace Gap Analysis — Strategy Layer & Round Progression (strategy / coaching / round-progression layer; this doc is the structural/schema companion)
- **Source artifacts:**
  - `/Users/nick/Downloads/updater-panel-prep_2.html` (Panel round: Andrew Regan, Chandeka Ork, Annie Lin)
  - `/Users/nick/Downloads/updater-doug-prep_1.html` (Technical round: Doug Roccato)
  - Also mirrored in the basic-memory vault under `facet/main/ref-materials` (authoritative personal copy; query via the basic-memory MCP server)
- **Current types:** `/Users/nick/Developer/Facet/src/types/prep.ts`
- **Current card renderer:** `/Users/nick/Developer/Facet/src/routes/prep/PrepCardView.tsx`
- **Current generator:** `/Users/nick/Developer/Facet/src/utils/prepGenerator.ts`
