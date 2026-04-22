---
id: doc-25
title: Prep Workspace Gap Analysis — Strategy Layer & Round Progression
type: other
created_date: '2026-04-19 05:14'
---
# Prep Workspace Gap Analysis — Strategy Layer & Round Progression

Gap analysis comparing the current prep workspace against reference interview prep documents (Unanet HM Prep, Blackstone R3 Prep, Generic Prep). The foundation is strong — the gaps are in the strategy/meta-coaching layer, not the architecture.

Reference material: `/Users/nick/Documents/Career/Job Search/Interview Prep/unanet-hm-prep.html`, `blackstone-prep-r3.html`, `generic-prep.html`, `/Users/nick/Documents/Career/Job Search/Interview Prep.html`

---

## Current State: Strong Foundation

The prep workspace is significantly further along than the search workspace. What's production-ready:

| Feature | Status | Implementation |
|---|---|---|
| Three-mode workspace (edit/homework/live) | ✅ Solid | `PrepPage.tsx`, `PrepPracticeMode.tsx`, `PrepLiveMode.tsx` |
| AI-driven company-specific generation | ✅ Solid | `prepGenerator.ts` — grounded in identity + resume + JD |
| Story-structured narratives (Problem/Solution/Result) | ✅ Solid | PAIO bullet mapping to story blocks |
| Gap framing scripts | ✅ Solid | Auto-generated from stack alignment gaps, tagged `gap-framing` |
| Stack alignment table (their tech vs. your match) | ✅ Solid | 5 confidence levels: Strong/Solid/Working/Adjacent/Gap |
| Confidence tracking in homework mode | ✅ Solid | Fisher-Yates shuffle, 1/2/3 grading, auto-requeue weak cards |
| Live cheatsheet with timer | ✅ Solid | Timer with 4 states, 30+ keyboard shortcuts, search overlay |
| Keyboard-native navigation | ✅ Solid | j/k, number keys, expand/collapse, search |
| Context gap detection → identity writeback | ✅ Solid | Multi-step modal, required/recommended/optional priority |
| Don'ts list + Questions to ask | ✅ Solid | Generated per deck, editable |
| Conditional follow-ups (pivot/trap/escalation) | ✅ Solid | Per-card `conditionals[]` with tone typing |
| Regenerate with gap answers (preserve manual cards) | ✅ Solid | AI cards replaced, manual kept, study progress carried forward |
| Deep dives per card | ✅ Solid | `deepDives[]` with title + content |
| Round-type awareness | ✅ Basic | 13 format types, affects generation emphasis |
| Identity integration | ✅ Solid | Metrics extracted directly, `[[needs-review]]` markers, no hallucination |
| Section-grouped sidebar | ✅ Solid | Intel/Openers/Core/Technical/Tactical grouping |

**The architecture doesn't need changes.** The data model (`PrepDeck`, `PrepCard`), store (`prepStore`), generator (`prepGenerator.ts`), and all three mode UIs are sound. The existing fields (`notes`, `warning`, `scriptLabel`, `categoryGuidance`, `conditionals`) can hold the missing content — the AI just needs to be instructed to generate it.

---

## Gaps: The Strategy/Meta-Coaching Layer

The reference prep docs don't just tell you WHAT to say — they tell you WHY to say it, WHEN to stop talking, HOW the interviewer is likely to react, and WHERE your experience is market-rare. This "career coach in the room" layer is what's missing.

### Gap 1: "Why This Works" Meta-Strategy

**Reference has:** Per-answer `info-card` blocks explaining the positioning logic:
> "This is rare. Most candidates have GitHub Actions or Jenkins. GitLab admin experience is uncommon. Lean into it."

> "Why this opener works for Unanet: Leads with 'platform and release engineer' not just 'platform engineer' — they're hiring for release/CI/CD specifically."

**Facet has:** Cards have `notes` and `warning` fields, but the AI doesn't generate meta-strategy content explaining WHY the answer is positioned the way it is.

**Fix:** Prompt engineering in `prepGenerator.ts`. Instruct the AI to generate a `notes` block on key cards (especially openers and gap-framing cards) explaining the positioning logic. No schema change needed — `notes` field already exists.

**Priority:** High — this is what turns a script into a strategy.

### Gap 2: Strategic Framing Notes (Interview Dynamic Coaching)

**Reference has:** Meta-coaching about the interview DYNAMIC itself:
> "They reached out to me. They already think there's fit. This round is 'do I want to work with this person' not 'convince me you belong here.' Be conversational."

> "Keep it under 90 seconds. This is a trailer, not the movie. End on the hook and let them ask the next question."

> "Don't fake this. GovCloud is a specific environment. If you pretend to know it and they ask follow-ups, you'll get caught."

**Facet has:** `warning` field per card, `donts[]` per deck, `categoryGuidance` per category. The structure exists but the AI generates content-focused warnings ("don't imply K8s ownership") not dynamic-focused coaching ("this is a conversation, not a pitch").

**Fix:** Add dynamic coaching instructions to the system prompt in `prepGenerator.ts`. The AI should generate:
- Per-deck framing note based on who reached out first (inbound vs. cold apply)
- Per-card delivery coaching (time limit, tone, when to stop talking)
- Per-gap cards: "Don't fake this" warnings with honest framing strategy

Use existing `warning` field for delivery coaching, `categoryGuidance` for section-level framing, and a new `deckFraming` field (or use existing `notes` on deck) for the overall interview dynamic.

**Priority:** High — changes how users deliver, not just what they say.

### Gap 3: Named Interviewer Intel

**Reference has:** Named team members with role inference:
> "Prashant Luthra — SVP Product Development. Likely 2 levels up from this role. Probably not the HM."
> "Sastry Anipindi — Sr. Director Product Development. Most likely the hiring manager."

**Facet has:** `companyResearch` free-text field on PrepDeck. No structured interviewer data.

**Fix:** Two options:
1. **Simple:** Instruct the AI to extract named people from company research text and render them as an intel section. No schema change — content goes into a dedicated card tagged `intel`.
2. **Structured:** Add `interviewers?: { name, title, role, notes }[]` to PrepDeck. More queryable but heavier.

**Recommendation:** Start with option 1 (prompt-only), move to option 2 if users want to track interviewers across rounds.

**Priority:** Medium — valuable for HM/exec rounds, less critical for initial screens.

### Gap 4: Competitive Positioning Context

**Reference has:** Market-rare framing for the candidate's strengths:
> "Windows release engineering is a dying art. Combining it with Linux, modern CI/CD, and actual software development is extremely rare."
> "Most 'DevOps' engineers have never touched Windows build toolchains."

**Facet has:** Gap framing acknowledges gaps but doesn't frame STRENGTHS as market-rare. The stack alignment shows confidence levels but doesn't say "this combination is unusual and valuable."

**Fix:** During generation, the AI should identify 2-3 skills or combinations where the candidate has a market-rare edge and generate a `notes` or `deepDive` block explaining WHY it's rare. This requires the search thesis or identity model to have unfair advantage data — connects to the search redesign (doc-24).

**Priority:** Medium — depends on search thesis / identity model enrichment.

### Gap 5: Per-Section Time Budgets with Tracking

**Reference has:** `data-budget="2"` per section. Sidebar nav shows time per item with `over-budget` / `near-budget` CSS classes. Users can see "I spent 4 minutes on this 2-minute section."

**Facet has:** Global timer with states. Cards have implicit time budgets in the generation prompt ("2m for behavioral") but live mode doesn't track or display per-section time.

**Fix:** 
1. Add `timeBudgetMinutes?: number` to the cheatsheet section derivation (already computed in `derivePrepCheatsheetSections()`).
2. Track time-in-section in live mode (start tracking when section scrolls into view or is navigated to).
3. Display budget + elapsed in sidebar nav next to each section link.
4. Color-code: near-budget (amber), over-budget (red).

**Priority:** Medium — nice UX polish for live mode. The timer infrastructure exists, just needs per-section granularity.

### Gap 6: Round Progression (R1 → R2 → R3)

**Reference has:** Blackstone R3 prep incorporates intel from R1:
> Section: "Round 1 Intel" — what was learned from previous round, used to inform R2/R3 strategy.

**Facet has:** `roundType` on PrepDeck selects the interview format. But no mechanism to:
- Debrief after a round ("What did they ask? What went well? What was surprising?")
- Feed debrief insights into the NEXT round's prep
- Generate round-specific coaching ("R1 was a recruiter screen. R2 will be HM — expect deeper technical questions about X based on what came up in R1.")

**Fix:** This is the biggest structural gap. Needs:

1. **Debrief capture:** After an interview round, a lightweight form or free-text field to record what happened: questions asked, what went well, what was awkward, new intel learned, their reactions.
   - Could be a new section on PrepDeck, or a `roundDebrief?: { roundNumber, notes, questionsAsked, surprises, newIntel }[]` field.

2. **Round-aware generation:** When generating prep for round N+1, include the debrief from round N as context. The AI can then:
   - "In R1 they asked about K8s admin experience. Expect them to probe deeper in R2. Here's how to handle the follow-up."
   - "You mentioned the Wayfair engagement in R1. They seemed interested — prepare a deeper version for R2."
   - "R1 was conversational and they seemed positive. R2 is with a more technical person — shift tone."

3. **Multi-deck linking:** Multiple PrepDecks for the same pipeline entry, linked by round number. Or a single PrepDeck with round-scoped sections.

**Recommendation:** Add `roundDebriefs: { round: number, date: string, notes: string, questionsAsked: string[], surprises: string[], newIntel: string[] }[]` to PrepDeck. When generating a new round's prep, pass previous round debriefs as context. Existing cards from previous rounds can be carried forward with round-specific updates.

**Priority:** High — this is the most impactful missing feature for users who advance past initial screens. The reference Blackstone prep shows how much better R3 prep is when it incorporates R1/R2 learnings.

---

## Implementation Plan

### Phase 1: Prompt Enrichment (No Schema Changes)

These are pure `prepGenerator.ts` system prompt improvements:

1. **"Why this works" meta-strategy** — instruct AI to generate `notes` blocks on opener/gap cards explaining positioning logic
2. **Strategic framing notes** — instruct AI to generate interview-dynamic coaching in `warning` fields and `categoryGuidance`
3. **Delivery coaching** — instruct AI to include time limits, tone guidance, "stop talking" reminders
4. **Named people extraction** — instruct AI to extract interviewer names from company research into a dedicated intel card
5. **Competitive positioning** — instruct AI to identify market-rare skill combinations and frame them

**Effort:** Prompt engineering only. No code changes outside `prepGenerator.ts` system prompt.
**Risk:** Low — additive content, no structural changes.

### Phase 2: Per-Section Time Tracking

1. Add `timeBudgetMinutes` to cheatsheet section derivation
2. Track time-in-section in live mode
3. Display budget + elapsed in sidebar nav
4. Color-code near/over budget

**Effort:** Moderate — UI changes in `PrepLiveMode.tsx`, section derivation logic in cheatsheet utils.
**Risk:** Low — additive feature.

### Phase 3: Round Progression

1. Add `roundDebriefs[]` to PrepDeck type
2. Build debrief capture UI (lightweight form after interview)
3. Pass previous debriefs to prepGenerator when generating next round's prep
4. Generate round-specific coaching based on debrief content

**Effort:** Medium — new type fields, new UI section, generation prompt changes.
**Risk:** Low-medium — new feature, but fits within existing deck architecture.

### Phase 4: Model Upgrade

1. Consider using `opus` for prep generation (currently sonnet with 90s timeout)
2. The strategy/meta layer benefits from the best available reasoning model
3. Tradeoff: quality vs. cost per generation (prep may be generated multiple times per pipeline entry)
4. Possible hybrid: sonnet for initial generation, opus for "enhance" pass that adds meta-strategy

**Effort:** Low — model parameter change. May need timeout increase.
**Risk:** Cost increase per generation.

---

## Connecting to Search Redesign (doc-24)

The enriched search results from the search redesign directly improve prep quality:

| Search Result Field | Prep Impact |
|---|---|
| `candidateEdge` ("Why this candidate wins") | → Seeds `positioning` on deck, AI uses for opener strategy |
| `interviewProcess.format` | → Pre-selects `roundType`, AI generates format-specific cards |
| `interviewProcess.builderFriendly` | → AI adjusts framing: "the interview format rewards your strengths" |
| `interviewProcess.aiToolsAllowed` | → AI generates "AI tools allowed" intel card + strategy note |
| `companyIntel.stage` | → AI adjusts expectations and company-specific hooks |
| `companyIntel.aiCulture` | → AI generates AI-culture positioning card |
| `advantageMatch` | → AI frames answers around the specific unfair advantage that drove the match |

The richer the pipeline entry (populated by better search), the better the prep generation. This is the compound context flywheel.

---

## Prep Quality Bar: What "Done" Looks Like

A fully realized prep deck for a specific company/round should look like the Unanet HM Prep reference:

1. **Company intel section** with structured data (what they do, scale, stack, AI posture, team structure)
2. **Named interviewer intel** with role inference and coaching ("Probably the HM. Be conversational.")
3. **Strategic framing note** setting the interview dynamic ("They reached out. Don't over-sell.")
4. **Custom opener** tailored to this company's needs, with meta-strategy explaining WHY it's framed this way
5. **Core pitch** (the career story) connected to THIS company's JD, with "Connection to [company]" card
6. **Stack-specific sections** (e.g., "GitLab CI/CD — Direct Match") with rarity framing
7. **Gap framing scripts** with honest acknowledgment + credible ramp story + "Don't fake this" warning
8. **Predicted questions** with company-specific tailored answers
9. **Delivery coaching** per answer (time limit, tone, when to stop)
10. **Time budgets** per section visible in sidebar with live tracking
11. **Previous round intel** (for R2+) feeding into updated strategy

The current system produces items 1, 4, 6, 7, 8 at decent quality. Items 2, 3, 5, 9, 10, 11 are the gaps.

---

## Reference Material

- `unanet-hm-prep.html` — Company-specific HM prep: intel grid, named people, strategic framing, custom opener with "why this works" meta-card, release engineering 3-act story with company connection, stack-specific sections (GitLab), gap framing (K8s, GovCloud, vertical), predicted Q&A with tailored answers, time budgets per section, keyboard shortcuts
- `blackstone-prep-r3.html` — Round-specific prep: "The Rules" banner, round 1 intel section, story cards with Problem/Solution/Result/Lesson structure, anti-pattern "Don'ts" list, tech refresh table, timer
- `generic-prep.html` — General cheatsheet: sidebar nav with section groups, per-section time tracking with over/near budget coloring, timer, keyboard shortcuts with nav-key display in sidebar, expandable card system
- `Interview Prep.html` — Earlier version of generic prep: section tags by era (A10/ThreatX/Vispero), variant scripts per answer
- Current implementation: `src/utils/prepGenerator.ts` (generation), `src/routes/prep/PrepLiveMode.tsx` (live cheatsheet), `src/routes/prep/PrepPracticeMode.tsx` (homework), `src/routes/prep/PrepPage.tsx` (workspace), `src/types/prep.ts` (data model), `src/store/prepStore.ts` (state)
- Search redesign: backlog doc-24 (enriched search results → richer pipeline entries → better prep)
