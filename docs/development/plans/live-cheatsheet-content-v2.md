# Live Cheatsheet Content V2

> Spec for upgrading the live interview cheatsheet from flat card rendering to the rich, structured content patterns demonstrated in the reference prep documents.

## Status

- **Layout**: Done (separate `/prep/live` route, flex sidebar, pre/live phase split, per-item budgets, pause/resume timer)
- **Content MVP**: This spec. Not started.

## Reference Material

- **Reference HTML (Blackstone R2)**: `blackstone-prep-r2.html` — rich content blocks, section grouping (Intel/Core/Technical/Tactical), stat boxes, story cards, Q&A, don'ts
- **Reference HTML (Blackstone R1)**: `blackstone-prep-r1.html` — glance points, three-layer disclosure, alternative narratives, trap/reframe pairs, labeled scripts, one-liners
- **Reference HTML (Unanet)**: `unanet-hm-prep.html` — conditional branching, scripted openers, gap-framing, technical drills, 3-act narrative, answer templates
- **Skill definition**: `.agents/skills/interview-prep/SKILL.md` — generation guidelines, round-type matrix, time budgets
- **Component catalog**: `.agents/skills/interview-prep/references/components.md` — block type patterns
- **Base template**: `.agents/skills/interview-prep/assets/base-template.html` — full interactive HTML template

## Data Flow Architecture

Facet's workspaces form a directed data pipeline. Each workspace reads from its upstream sources and never re-extracts what an upstream workspace already owns.

```
Resume YAML ──→ Build (assembly)

Raw career text ──→ Identity (extraction, structuring, enrichment)
                       │ (read-only downstream)
                       ▼
                    Match (identity × JD fit analysis)

Web search ──→ Research (search, tier, score)
                  │
                  │ "Add to Pipeline"
                  ▼
               Pipeline (canonical per-opportunity store)
                  │
                  │ "Investigate" (incremental AI enrichment)
                  │  └─ Fills JD, formats, contacts, research — skips populated fields
                  │
                  ├──→ Prep (interview content generation)
                  └──→ Letters (cover letter generation)
```

### Data flow is strictly one-directional

- Research → Pipeline (seed entry) → never flows back
- Identity → Match / Prep / Letters (read-only) → proposals back via draft mechanism only
- Investigation enriches pipeline entries incrementally, not from scratch

### Upstream ownership

| Data | Owner | Downstream consumers |
|------|-------|---------------------|
| Structured career data (bullets with problem/action/outcome, metrics, skills) | **Identity** | Match, Prep, Letters |
| Company/role context (JD, positioning, stage, comp, research, skill match) | **Pipeline** | Prep, Letters |
| Job-candidate fit analysis (match score, gap analysis, vector recommendation) | **Match / Research** | Pipeline, Prep |
| Interview prep content (cards, don'ts, questions, scripts) | **Prep** | (terminal) |

### Rules

1. **Prep reads from identity for candidate data.** Structured bullets, metrics, skills, interview style. Falls back to resume when identity is not loaded.
2. **Prep reads from pipeline for opportunity data.** Company, role, JD, stage/round, positioning, comp, research notes. Prep does not re-collect or re-extract this data.
3. **Research seeds pipeline; pipeline never flows back to research.** When a search result is added to pipeline, it arrives as a "seeded" entry with partial data (company, role, positioning, skill match, risks). Research's job is done at that point. Research should preserve all potentially useful data on the seed even if it's not surfaced in the search results UI — downstream consumers (investigation, prep) may need it.
4. **Investigation incrementally enriches pipeline entries.** The "Investigate with AI" flow fills gaps: JD, interview formats, recruiter contacts, research sources. It should skip fields that are already populated and only research what's missing. This makes re-investigation safe and useful — the user can paste a JD manually, then investigate to fill remaining gaps (contacts, interview signals) without overwriting.
5. **Pipeline is the canonical per-opportunity store.** It owns company, role, JD, stage, formats, positioning, comp, research, contacts. Prep and Letters are downstream consumers — they read from pipeline, they don't duplicate or re-collect this data.
6. **Identity is the sole extraction authority** for structured career data. No downstream workspace runs LLM extraction against raw career text.
7. **Downstream workspaces propose changes to upstream via drafts.** Prep can collect context gap answers and queue them as identity drafts (`identityStore.setDraft()`). Same pattern as the debrief workspace. Never direct mutation.
8. **Prep decks accumulate per opportunity, show next-up.** Multiple rounds for the same company produce multiple decks. The library groups them by company (already implemented) and surfaces the most recent / next-up deck. Earlier round decks are retained — they carry forward intel, stories, and interviewer context that's useful for later rounds. A reasonable retention limit (e.g., 5 decks per company) prevents unbounded growth.

### Implications for prep generation

The prep generator should receive two upstream contexts:
- **From identity**: vector-relevant roles with structured bullets, skills with depth/positioning, interview_style, departure context
- **From pipeline**: company, role, JD, round type, positioning, comp data, research notes, skill match

The generator does NOT:
- Re-extract story structure from flat resume text (identity already did this)
- Re-collect company/JD data (pipeline already has this)
- Write directly to identity or pipeline stores

## Architecture Review Decisions

Decisions from architecture review (incorporated into this revision):

1. **Don'ts and questions-to-ask are deck-level fields**, not card categories. They're lightweight data that doesn't belong in the full PrepCard model with study progress, homework filtering, etc.
2. **PrepCategory is NOT extended** — questions and donts are deck-level, not card-level.
3. **Derivation passes cardId, not mirrored fields** — the renderer looks up rich content from the source card by ID. The derivation layer handles section grouping and ordering only.
4. **Generation comes before rendering** in phase order — you need real AI-produced data to build and test the renderer against.
5. **Identity feedback writes to identity model only**, not dual-write. Deck stores `contextGapAnswers` for raw responses; identity model is source of truth.
6. **Section guidance is per-category on the deck**, not keyed by fragile section IDs.
7. **Edit mode for new types is in the MVP**, not deferred to polish.
8. **Round type is a required deck field**, resolved before generation work.
9. **Identity injection is selective** — filter to vector-relevant roles/bullets, include interview_style, skip irrelevant sections.
10. **Prep proposes identity changes via drafts only.** Context gap answers are stored on the deck (`contextGapAnswers`). A utility converts them to an `IdentityExtractionDraft` and calls `identityStore.setDraft()`. The user reviews in the identity workspace. Same pattern as the debrief workspace.
11. **Resume data is the fallback, not the primary source.** When identity is loaded, prep generation uses structured identity data. When identity is null (user hasn't built one yet), it falls back to the existing `resumeContext` path.

---

# Part A: MVP

The minimum viable slice that delivers the most user value. Targets the three-layer disclosure model and the most-requested missing sections.

## A1. Data Model Changes

### PrepCard additions

```typescript
interface PrepStoryBlock {
  label: 'problem' | 'solution' | 'result' | 'closer' | 'note'
  text: string
}

interface PrepCard {
  // ... existing fields unchanged
  storyBlocks?: PrepStoryBlock[]   // Structured narrative (behavioral/project)
  keyPoints?: string[]             // Glance points — 3-5 scannable bullets
  scriptLabel?: string             // Label for script block ("Say This", "The Pitch", etc.)
}
```

These three fields deliver the core content upgrade:
- `storyBlocks` → structured Problem/Solution/Result/Closer narratives
- `keyPoints` → scannable glance points above the detail block
- `scriptLabel` → contextual label on script blocks

### PrepDeck additions

```typescript
interface PrepDeck {
  // ... existing fields unchanged
  roundType?: InterviewFormat             // Reuse pipeline's InterviewFormat type
  donts?: string[]                        // Personalized anti-patterns
  questionsToAsk?: Array<{ question: string; context: string }>  // With coaching context
  categoryGuidance?: Record<string, string>  // Per-category section guidance
}
```

- `roundType` — uses the existing `InterviewFormat` union from `src/types/pipeline.ts` (e.g., `'hm-screen'`, `'tech-discussion'`, `'system-design'`). When creating a deck from a pipeline entry, the user picks which round they're prepping for from the entry's `format[]` array. This keeps pipeline as the owner of "what formats does this opportunity have" and the deck as "which one am I prepping for right now."
- `donts` — deck-level, not card-level (flat list of strings)
- `questionsToAsk` — deck-level, not card-level (lightweight q + context)
- `categoryGuidance` — keyed by category name (stable), not section ID (fragile)

### PrepFollowUp addition

```typescript
interface PrepFollowUp {
  id?: string
  question: string
  answer: string
  context?: string  // "Why this question matters" coaching note
}
```

### PrepCheatsheetSection addition

```typescript
interface PrepCheatsheetSection {
  // ... existing fields
  guidance?: string  // Section-level coaching note (blue block at top)
  group?: string     // Group label for sidebar grouping
}
```

### Store sanitization

Update `sanitizeCard` to preserve/validate:
- `storyBlocks` — validate each entry has a string `label` in the allowed set and a string `text`
- `keyPoints` — validate as string array, filter empty entries
- `scriptLabel` — validate as string, trim

Update `sanitizeDeck` to preserve/validate:
- `roundType` — validate against allowed values
- `donts` — validate as string array, filter empty entries
- `questionsToAsk` — validate each has `question` string, optional `context` string
- `categoryGuidance` — validate as Record<string, string>

## A2. Generation Prompt Upgrade

### Keep sonnet for MVP

The architecture review noted that Opus is 5x the cost. For MVP, keep sonnet but upgrade the prompt structure. Opus is a follow-up decision after evaluating sonnet's output with the richer prompt.

### Read from identity, fall back to resume

The prep generator should accept `currentIdentity` from `identityStore` and use it as the primary candidate context:
- **When identity is loaded**: Pass vector-relevant roles with structured bullets (`problem`, `action`, `outcome`, `impact[]`, `metrics{}`), skills with depth/positioning, and `self_model.interview_style`. The AI receives human-reviewed decomposition — it maps identity bullets to story blocks instead of re-extracting from flat text.
- **When identity is null**: Fall back to the existing `resumeContext` path (assembled resume with flat bullet text).

This is a pure read from `identityStore`. No writes. Immediate quality improvement.

### Prompt changes

The generation prompt should request:
1. **Story blocks** for behavioral and project cards — mapped from identity bullet structure (problem→problem, action→solution, outcome→result), not re-extracted from flat text
2. **Key points** for every card (3-5 glance bullets)
3. **Script labels** where appropriate ("Say This", "Lead With", "The One-Liner")
4. **Don'ts** as a deck-level list (5-8 personalized, not generic)
5. **Questions to ask** as a deck-level list (3-5 with context)
6. **Category guidance** — per-category coaching note for section headers
7. **Round type** — pass the deck's round type so the AI adjusts emphasis
8. **Metrics from identity** — pass structured `metrics{}` from relevant bullets so Numbers to Know uses real data, not AI inferences

### Response schema (MVP)

```typescript
interface PrepGenerationResponseV2 {
  deckTitle: string
  companyResearchSummary?: string
  categoryGuidance?: Record<string, string>

  cards: Array<{
    category: PrepCategory
    title: string
    tags: string[]
    script?: string
    scriptLabel?: string
    warning?: string
    notes?: string
    storyBlocks?: PrepStoryBlock[]
    keyPoints?: string[]
    followUps?: PrepFollowUp[]
    deepDives?: PrepDeepDive[]
    metrics?: PrepMetric[]
    tableData?: { headers: string[]; rows: string[][] }
  }>

  donts?: string[]
  questionsToAsk?: Array<{ question: string; context: string }>
}
```

### Normalizer updates

Extend `normalizeCards` to:
- Coerce storyBlock labels (e.g., "Problem Statement" → "problem")
- Drop malformed storyBlocks/keyPoints entries instead of failing
- Extract donts and questionsToAsk from the response and store on the deck
- Validate scriptLabel as a non-empty string

## A3. Cheatsheet Derivation Changes

### New sections to derive

| Section | Source | Group |
|---------|--------|-------|
| Questions to Ask | `deck.questionsToAsk` | Tactical |
| Don'ts | `deck.donts` | Tactical |

### Derivation passes cardId for rich content

Items keep the existing `cardId` field. The renderer looks up the source card from the deck when it needs storyBlocks, keyPoints, or metrics. The derivation layer does NOT mirror these fields onto items.

### Section guidance

`derivePrepCheatsheetSections` reads `deck.categoryGuidance` and attaches the matching guidance string to each section.

### Group metadata

Each section gets a `group` field based on its category:
- Intel group: overview, intel
- Core group: opener, behavioral, project
- Technical group: technical, situational
- Tactical group: questions, donts, metrics, warnings

## A4. Rendering Changes

### Three-layer disclosure in SectionBlock

Every card item renders in the three-layer pattern:

1. **Glance points** (if `keyPoints` exists on source card) — arrow-prefixed bullet list
2. **Script / detail** — with visual differentiation:
   - `script` → green left-border block with `scriptLabel` (default "Say This")
   - `warning` → red left-border block with "Caution" label
   - `notes` → blue left-border block with "Context" label
3. **Story blocks** (if `storyBlocks` exists) — color-coded Problem/Solution/Result/Closer labels

### Stat boxes for metrics

Cards with `metrics[]` render them as horizontal flex stat cards:
- Large monospace value (18px+, accent color)
- Small label underneath (10px, muted)

### Q-cards for questions-to-ask section

Deck-level `questionsToAsk` renders as:
- Question text (bold, 14px)
- Context (italic, muted, 12px)
- Section guidance block: "Pick 2-3. Save 8-10 minutes for questions."

### Don't list

Deck-level `donts` renders as:
- Red X (✕) bullet list
- Single sentences, no nesting

### Library: round progression within company groups

The library already groups decks by company. Within each company group, decks should show:
- The round type label (e.g., "HM Screen", "Technical", "System Design") from `deck.roundType`
- Most recent deck highlighted as "Next Up"
- Earlier round decks visible but visually secondary (muted, smaller)
- A retention limit of ~5 decks per company — oldest auto-archive beyond that

This gives the user a timeline of their prep for each opportunity: R1 recruiter screen → R2 hiring manager → R3 technical → etc.

### Section group headers

Sidebar nav and main content show group headers (Intel, Core, Technical, Tactical) above their sections.

### Budget adjustments

- **No budget** on: Questions to Ask, Don'ts, Numbers to Know, Intel sections
- **Per-item budget** on: Opener, Behavioral, Technical, Project, Situational

## A5. Edit Mode for New Types

### StoryBlocks editor

When a card has `storyBlocks`, show a structured editor:
- Each block has a label selector (problem/solution/result/closer/note) and a textarea
- Add/remove block buttons
- Fallback: if no storyBlocks, show the existing flat `script` textarea

### KeyPoints editor

Simple string list editor (one input per point, add/remove buttons). Similar to existing tags editor but for bullets.

### Don'ts editor (deck-level)

Simple string list editor in the "Active Prep Set" panel, not per-card.

### Questions editor (deck-level)

List of {question, context} pairs in the "Active Prep Set" panel. Each entry has two inputs.

### Round type selector

Dropdown in "Deck Basics" alongside company/role/vector.

## A6. MVP Implementation Order

### Phase 1: Types + Store (1-2 tasks)
1. Add `storyBlocks`, `keyPoints`, `scriptLabel` to `PrepCard` type
2. Add `roundType`, `donts`, `questionsToAsk`, `categoryGuidance` to `PrepDeck` type
3. Add `context` to `PrepFollowUp`
4. Add `guidance`, `group` to `PrepCheatsheetSection`
5. Update store sanitization for all new fields

### Phase 2: Generation (3-4 tasks)
6. Wire `identityStore.currentIdentity` into `PrepPage.tsx` — read identity, filter to vector-relevant roles/bullets/skills, build focused identity context
7. Restructure generation prompt to: use identity bullets for story blocks, request keyPoints, scriptLabel, donts, questionsToAsk, categoryGuidance
8. Pass round type and identity metrics to generation
9. Update `normalizeCards` and response parsing for new fields
10. Store donts/questionsToAsk/categoryGuidance on deck after generation

### Phase 3: Derivation (1 task)
10. Add Questions to Ask and Don'ts sections to `derivePrepCheatsheetSections`
11. Attach categoryGuidance to sections
12. Add group metadata to all sections

### Phase 4: Rendering (2-3 tasks)
13. Add CSS for: story blocks (color-coded labels), glance-points list, colored guidance blocks (script/warning/notes), stat boxes, Q-cards, don't list, section group headers
14. Update `SectionBlock` — render three-layer disclosure (glance points → labeled script/notes/warning → storyBlocks)
15. Render Questions to Ask and Don'ts sections
16. Add section group headers to sidebar nav and main content
17. Adjust budget display (no budget on tactical sections)

### Phase 5: Edit Mode (1-2 tasks)
18. StoryBlocks editor in PrepCardView
19. KeyPoints list editor in PrepCardView
20. Don'ts and Questions editors in deck-level "Active Prep Set" panel
21. Round type selector in Deck Basics

### Phase 6: Test + Verify (1 task)
22. Update store sanitization tests
23. Test cheatsheet derivation with new section types
24. Visual verification of all new block types in live mode

---

# Part B: Follow-Up (V2.1)

Features that build on the MVP but require identity model integration, additional AI capabilities, or significant new UX.

## B1. Conditional Branching (§2d)

Add `conditionals?: PrepConditional[]` to PrepCard. Render as trigger/response blocks. Trap-toned conditionals render as Trap/Reframe pairs (§3j). Requires prompt upgrade to request "if they push" guidance.

## B2. Scripted Openers as Standalone Sections (§2c)

Promote opener cards from the Core group to their own Openers group. Each opener gets a standalone section ("Tell me about yourself", "Why this role?", "Why did you leave X?"). Requires identity model departure context for the "why did you leave" section (§B8).

## B3. Gap Framing (§2e)

AI identifies gaps from JD vs resume and generates gap-framing cards (honest acknowledgment + bridge). Requires identity model skill data injection.

## B4. Technical Drills with Answer Template (§2f)

Add `answerTemplate` to PrepDeck. Drills follow the template pattern. Prompt requests 5-10 drills for technical/system-design round types.

## B5. Alternative Narratives (§3i)

Add `alternativeTitle`, `alternativeScript` to PrepCard. Prevents story brittleness with backup narratives.

## B6. Numbers to Know — Identity Model Pull (§2g)

Inject identity model `ProfessionalRoleBullet.metrics` into generation. Selective injection: filter to vector-relevant roles/bullets only. Two groups: candidate metrics + company metrics.

## B7. Stack Alignment Table (§3g)

AI compares JD tech requirements against identity model skills. Produces "Their Stack | Your Match | Confidence" table.

## B8. Context Gap Feedback Loop (§9)

Full implementation:
- `contextGaps` on generation response
- Edit page banner + guided modal
- Deck stores `contextGapAnswers: Record<string, string>` for raw user responses
- A utility converts relevant answers to an `IdentityExtractionDraft` (same pattern as debrief's `buildDebriefIdentityDraft`)
- Calls `identityStore.setDraft()` to queue identity changes — user reviews in identity workspace
- **Prep never calls identity mutation actions directly** (no `updateScannedBulletMetrics`, no `saveSkillEnrichment`)
- Visual indicators for placeholder/needs-review content in cheatsheet
- Re-generation of affected sections after gap fill

## B9. Homework Mode Enhancements (§10)

- Story blocks in flashcards (title + glance points as cue, blocks on reveal)
- Conditional drilling (triggers as secondary flashcards)
- Opener-specific homework filter
- Exclude placeholder cards from homework
- "Needs attention" count in filter bar

## B10. Opus Model Switch (§4a)

Evaluate sonnet output quality with the richer MVP prompt first. If insufficient, switch to opus. Note: ~5x cost increase. User pays directly via proxy — document the tradeoff.

## B11. Narrative Arcs / 3-Act Structure (§3h)

Multi-role narrative arc for the opener/core-pitch. Requires 3+ relevant roles in identity model.

## B12. One-Liners / Quotable Takeaways (§3l)

Request 1-2 one-liners per major story card. Could use `scriptLabel: "The One-Liner"` on existing script field.

---

## Open Questions (for V2.1)

1. **Per-section timers vs global timer** — Both references track per-section time. Current: single global timer. Deferred pending user feedback.
2. **Interviewer intel** — Structured fields on deck vs special card category? Deferred to B2/B8.
3. **Multiple interviewers** — Array support for panel rounds? Deferred.
4. **Drill depth vs count** — 9 drills (Unanet) vs 3-5 with user adding more? Deferred to B4.
5. **Compensation section** — Manual-only or AI-generated from pipeline comp data? Deferred.
6. **Skill integration strategy** — Embed guidelines in prompt (a), use as resource (b), or use skill as the generation agent (c)? MVP uses (a). Evaluate (c) for V2.1.

---

## Content Quality Bar

Applies to both MVP and V2.1:

- **Scripts are rehearsal-ready**: Full sentences, not bullet points
- **Coaching is situation-specific**: "If they push" / "The trap is" / "Don't dwell"
- **Gaps are framed, not hidden**: Honest acknowledgment + bridge
- **Numbers are concrete**: "$50M/yr", "600+ pipelines", "~75us"
- **Glance points on every card**: 3-5 scannable bullets before the detail
- **Don'ts are personalized**: Inferred from candidate/company gap, not generic
- **Questions show coaching context**: Why to ask + what to listen for
