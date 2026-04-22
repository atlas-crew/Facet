---
id: doc-26
title: Shepherding Design — Extraction Loops & Correction Flow Architecture
type: other
created_date: '2026-04-19 05:38'
updated_date: '2026-04-19 05:50'
---
# Shepherding Design — Extraction Loops & Correction Flow Architecture

How the app guides users through the extraction process that makes everything work. The identity model gets richer as a side effect of doing real work — not as a separate "improve your profile" step.

**Core principle:** The user never fills out a form. They edit a mirror. Every interaction is a chance to learn something about the user, and every correction makes everything else better.

---

## Why This Matters

Facet's output quality is directly proportional to the depth of the identity model (doc-21, Product Philosophy). The identity model gets deep through:
- **Mechanism A:** Explanatory correction — user corrects an assumption by explaining their reasoning, revealing judgment the resume undersold
- **Mechanism B:** Fresh-context self-critique — AI reviews its own output with fresh eyes and updated context, producing better versions

The app must create natural moments for both mechanisms throughout the user journey — embedded in the workflow, not bolted on as a separate task.

**The engagement threshold:** The product requires commitment. The $149/90-day pass is a commitment filter. But even committed users will disengage if extraction feels like data entry. The shepherding design makes extraction feel like the app is attentive and responsive.

---

## Free Context Sources (Pre-Extraction Accelerators)

Before the correction loop even starts, the user may already have rich career context sitting in other systems. Don't ask them to recreate it — import it.

### AI Conversation Export (Highest Value)

Users in Facet's target market have almost certainly discussed their career with ChatGPT, Claude, or other AI assistants. Those conversations contain extraction gold: the AI probed, the user explained, level-correction may have already happened, voice patterns are embedded.

**Mechanism:** At onboarding (or any time), offer:

> "Have you discussed your career with ChatGPT, Claude, or another AI? If so, paste this prompt into that conversation and share what it produces."

**The export prompt:**

```
I'm moving to a new career tool and I'd like to export what you know about me.
Please produce a structured summary of everything you know about my professional
background, including:

1. Roles, companies, dates, and what I actually did (not just titles)
2. Technical skills and how deeply I use each one
3. Projects I've described to you and what was interesting about them
4. Career goals, preferences, or constraints I've mentioned
5. Interview prep we've done — questions practiced, stories refined
6. Cover letters or resume content we've worked on
7. Any career advice or strategy we discussed
8. My communication style or voice patterns you've noticed
9. Things I've said I'm NOT good at or don't want to do
10. Anything else that would help a new career tool understand me

Format this as a detailed narrative, not a resume. Include specifics, numbers,
and context — the kind of detail that would be lost in a resume format.
```

**Why this is so valuable:**
- Already been through correction cycles — the user explained and corrected in those conversations
- Includes things NOT on the resume — goals, calibration, voice, strategy
- Narrative form — richer and more nuanced than any form input
- Level-correction may be embedded — the AI may have already identified "this is staff-level work"
- Voice data included — how the user communicates about their career
- Zero additional work for the user — just paste a prompt and share the output

**Ingestion:** The exported narrative feeds into the identity extraction pipeline as supplementary context alongside the resume. The AI uses it to produce a richer first-pass identity model, reducing the number of correction cycles needed to reach useful depth.

### Other Free Context Sources

| Source | What It Contains | How to Request | Value |
|---|---|---|---|
| **LinkedIn profile** | Job history, skills, endorsements, bio, recommendations | URL or PDF export | Medium — structured but shallow |
| **GitHub profile** | Projects, languages, contribution patterns, README quality | Username → API scrape or URL | Medium — proves what they've built |
| **Old resumes** (multiple versions) | How they've positioned differently over time | File upload | High — shows positioning evolution |
| **Cover letters sent** | Voice, positioning angles, per-company framing | File upload or paste | High — voice + strategy data |
| **Brag docs** | Pre-organized accomplishments with context, metrics, narrative | File upload or paste | Very high — maps directly to PAIO bullet structure; people who maintain brag docs are exactly Facet's audience |
| **Portfolio / personal site** | Project descriptions, blog posts about their work | URL | Medium — self-narrated context |
| **Performance reviews** | Manager's assessment, accomplishments, growth areas | Paste or upload | Very high — external validation + level signal |
| **Recommendation letters / LinkedIn recs** | How OTHERS describe them (third-party voice, perceived strengths) | Paste | High — external perspective |
| **Job descriptions they've saved/liked** | What they're drawn to, implicit preferences | Paste or save from pipeline | Medium — preference signal |

### When to Surface These

**Don't dump all at onboarding.** Surface contextually:

- **AI export prompt:** At onboarding, prominently. This is the highest-value, lowest-effort source.
- **LinkedIn:** At onboarding alongside resume upload. Natural pairing.
- **Brag docs:** At onboarding or during identity extraction — "Do you keep a brag doc or accomplishment log? It's the single best input for building your career model."
- **GitHub:** When generating the identity model's projects section, or when the user mentions open-source work.
- **Old resumes / cover letters:** When the user is in the Build workspace editing their resume — "Have any previous versions? They help me understand how you've positioned yourself before."
- **Performance reviews / recs:** During identity extraction when the AI detects thin context on impact/outcomes — "Do you have a performance review or recommendation that describes this work? It helps me see how others perceived it."

### The Pattern

Don't ask users to create new content. Find where the context already exists and import it. Every free source reduces the number of correction cycles needed to reach useful depth.

---

## The User Journey with Extraction Loops

```
Free Context ──→ Onboarding ──→ Search Thesis ──→ Search Results ──→ Pipeline
     ↓              ↓               ↓                  ↓               ↓
  [AI export,    [identity      [depth +           [preference     [positioning
   LinkedIn,      bootstrap]     strategy]          discovery]       + voice]
   brag docs,        ↓               ↓                  ↓               ↓
   GitHub]           └───────────── identity model enriches ←────────────┘
     ↓                                   ↓
     └──────────────────↗
                 Cover Letter ──→ Interview Prep ──→ Debrief ──→ Outcome
                      ↓               ↓                ↓           ↓
                   [voice          [gap depth +      [intel +    [pattern
                    extraction]     calibration]      R2 prep]    learning]
                      ↓               ↓                ↓           ↓
                      └───────── identity model enriches ←─────────┘
```

Every stage extracts different signals. The identity model is never "done."

---

## Stage 1: Onboarding (Identity Bootstrap)

User arrives with a resume, maybe a LinkedIn profile. They want to start searching.

### The Trap
Letting them upload a resume and immediately start searching with thin context. First search produces generic results. User thinks "this is just another resume tool."

### The Shepherd

1. **Context gathering** — before generating the identity model, offer:
   - Resume upload (required)
   - LinkedIn profile URL (optional, low effort)
   - AI conversation export (optional, highest value) — show the export prompt
   - Brag doc (optional, very high value) — "Keep an accomplishment log? It's the best input we can get."
   - GitHub username (optional)
   
   Frame as: "The more context I have, the sharper your first results will be. Your resume is the minimum — but if you've discussed your career with ChatGPT or Claude, that conversation is the richest source."

2. **AI generates first-pass identity model** from all available sources
   - Archetype identification ("Builder," "Optimizer," "Connector")
   - Skills with inferred depth (using PAIO bullet analysis + AI export + brag doc context)
   - Draft vectors (2-3 positioning angles)
   - Work summary narratives
   - Open questions / gaps detected

3. **The mirror** — user sees their career reflected back, imperfectly
   - NOT a form to fill out
   - A generated profile to react to
   - The AI's interpretation of who they are

4. **Targeted correction prompts** — surface 5-8 things the AI is LEAST confident about
   - "I marked Kubernetes as 'strong' — is that right, or do you use it differently?" 
   - "Your archetype looks like 'Builder' — someone who gets dropped into a gap and ships. Does that resonate?"
   - "I see Python and C# across your roles. Is the combination deliberate, or just how it happened?"
   - Don't dump 50 questions. Pick the highest-impact corrections.

5. **Visible downstream impact** — each correction shows what it changes
   - "You corrected K8s to 'strong user, not admin' → search will avoid K8s admin roles → prep cards will frame K8s honestly"
   - This makes correction feel like progress, not data entry

### What Gets Extracted
Facts, initial context, first-pass depth, archetype confirmation, voice hints, pre-existing correction history (from AI export), structured accomplishments (from brag doc).

### Anti-Patterns to Avoid
- ❌ "Complete your profile" progress bar (feels like a form)
- ❌ Dumping all corrections at once (overwhelming)
- ❌ Blocking search until profile is "complete" (kills momentum)
- ❌ Requiring all context sources (resume is minimum; everything else is optional acceleration)
- ✅ Let them search with a thin profile, but show them what they're missing: "Your search would be sharper if I knew X"

---

## Stage 2: Search Thesis (Strategy Extraction)

User wants to find jobs. The search thesis generates from the identity model (doc-24, Phase 1).

### Correction Moments (Embedded in Thesis Review)

The thesis is the richest correction opportunity because it's the first time the user sees the AI's STRATEGIC interpretation of their career — not just facts, but what those facts mean.

- **Unfair advantage review:** "I identified 'Platform + Security + Fleet Management' as your unfair advantage. Is that right?"
  - User confirms → thesis strengthened
  - User corrects: "My security experience is more architectural than hands-on" → skill depth updates, thesis adjusts

- **Skill depth map:** Every skill listed with inferred semantic depth + calibration
  - "Rust — working (builds production systems with AI augmentation, not writing unsafe blocks)" 
  - User corrects: "Actually, I've gotten more comfortable — I'd call it strong for my use case" → depth updates across system

- **Search lanes:** "I'm suggesting 3 lanes: Security Platform, Release Engineering, Builder-Friendly Culture"
  - User removes a lane → thesis refocuses
  - User adds a lane → new vector may be created in identity model

- **Interview process strategy:** "Builder archetype → take-homes, portfolio reviews"
  - User confirms → preferences solidified
  - User corrects: "I'm actually fine with system design whiteboarding, just not leetcode" → preferences refined

### What Gets Extracted
Semantic skill depth (the most important extraction), honest framing / calibration notes, preference nuance (conditional avoids), competitive positioning awareness, strategic self-understanding.

### Key Design Point
The thesis correction is the most valuable extraction moment in the product. Users are engaged because they're about to spend $5-15 on a deep search. They WANT the thesis to be right. This is the moment to get depth and calibration data that improves everything downstream.

---

## Stage 3: Search Results → Pipeline (Discovery Extraction)

Results come back. User reviews and reacts.

### Correction Moments (Lightweight, Inline)

- **Thumbs up on a result** → optional "Why was this good?" → preference discovery
  - "I liked the interview process" → reinforces interview prefs
  - "I didn't know I'd be a fit for this type of company" → vector expansion

- **Thumbs down on a result** → optional "Why was this wrong?"
  - "I don't actually want to use Go daily" → avoid list update
  - "This role is too junior" → seniority calibration
  - "The interview process is a red flag" → interview pref reinforcement

- **Push to pipeline** → positioning narrative pre-filled from search result's `candidateEdge`
  - User edits positioning → voice signal + positioning refinement

### What Gets Extracted
Preference refinement, vector discovery, avoid list conditioning, seniority calibration. Each reaction improves the next search.

### Key Design Point
Keep it lightweight. A thumbs up/down with optional one-liner. Don't turn result review into a survey. The user is browsing, not filling out forms.

---

## Stage 4: Application (Voice Extraction)

User generates a cover letter for a pipeline entry.

### Correction Moments (Natural, Through Editing)

- AI generates letter in seeded voice (founder's voice as default)
- User edits: changes tone, rewrites a paragraph, adjusts formality
- **Every edit is two signals:** factual correction + voice preference
- The delta between AI output and user edit trains the voice model implicitly

### Fresh-Context Critique Triggers

- User switches target vector on a pipeline entry → "Your cover letter was optimized for Platform. You've switched to Security Platform. Refresh?"
- Identity model changed since letter was generated → "Your K8s depth was corrected since this letter was written. It currently says 'deep Kubernetes expertise.' Refresh?"

### Additional Context Prompt
After 2-3 cover letters, if voice hasn't converged: "Want to share a cover letter you've written before? It helps me match your natural voice faster."

### What Gets Extracted
Voice patterns, communication style, formality level, what the user emphasizes vs. cuts. After 3-4 cover letters, the voice converges toward the user's natural writing.

---

## Stage 5: Interview Prep (Depth Extraction)

User generates prep for an upcoming interview.

### Correction Moments (Context Gaps + Gap Framing)

- **Context gaps surface:** "I need to know about your departure from A10 to write the 'Why are you leaving?' card"
  - User fills gap → answer queued to identity model (with confirmation)
  - Gap filled → prep regenerates with richer context

- **Gap framing scripts trigger depth corrections:**
  - AI generates: "I'm honest — K8s is not my primary area"
  - User corrects: "Actually, I want to be more specific — I build platforms AROUND K8s, I'm not the K8s admin"
  - Correction updates identity model calibration: `SkillGroup.calibration = "builds around K8s, not a K8s admin"`

- **"Why this works" meta-strategy teaches positioning:**
  - AI generates: "This opener emphasizes release engineering because their JD prioritizes CI/CD"
  - User reads and understands their own positioning logic — this is coaching, not just scripting
  - If user disagrees: "Actually, I want to lead with the security angle" → positioning correction

### Additional Context Prompt
During prep, if the identity model is thin on project depth: "Do you have any internal documentation, architecture decision records, or project READMEs? Even a few pages would dramatically improve your prep depth." This is the 170-pages-of-docs amplifier — surface it when the user is motivated (they have an interview coming).

### What Gets Extracted
Departure context, gap framing language, honest depth calibration, strategic self-awareness. Prep is the deepest extraction stage because the user is thinking hardest about how to present themselves.

---

## Stage 6: Interview Debrief (Intel Extraction)

User comes back from an interview round.

### Correction Moments (Structured Debrief)

Lightweight form after the interview:
- "What did they ask?" → trains predicted questions for this company type
- "What went well?" → confirms which stories/angles work
- "What was surprising?" → new intel for next round
- "How did they react to [specific topic]?" → calibrates positioning
- "What would you do differently?" → coaching refinement

### Fresh-Context Critique Triggers

- Debrief entered → "Your Round 2 prep should account for what happened in Round 1. Refresh?"
- Updated prep incorporates R1 intel:
  - "They asked about K8s in R1 — expect deeper follow-up in R2"
  - "They seemed interested in the Wayfair story — prepare the extended version"
  - "R1 was conversational — R2 is with a more technical person, shift tone"

### What Gets Extracted
Interview performance data, company-specific intel, round-over-round learning. This is the feedback loop that makes multi-round interviews dramatically better (see doc-25, Gap 6).

---

## Stage 7: Outcome (Pattern Extraction)

User gets an offer, rejection, or ghosts.

### Correction Moments

- **Offer:** "What was the offer? What did you negotiate?" → comp data for future negotiations
- **Rejection with reason:** "Wanted Go experience" → "Your identity model shows Go as 'basic'. Should I deprioritize Go-heavy roles?"
- **Pattern across rejections:** "3 of your last 5 rejections cited K8s admin experience. Adjust search thesis to avoid cluster-admin roles?"
- **Ghost:** "How long has it been?" → pipeline hygiene, company avoid list

### What Gets Extracted
Outcome data, rejection patterns, comp negotiation data, search thesis recalibration. This is the longest-term learning loop — it requires multiple applications to generate patterns.

---

## Cross-Cutting: Fresh-Context Critique Triggers

Throughout the journey, the app should detect when existing artifacts may be stale and offer refresh:

| Trigger | What's Affected | Prompt to User |
|---|---|---|
| Skill depth corrected | Search thesis, cover letters, prep cards with that skill | "Your [skill] depth changed. N artifacts may benefit from a refresh." |
| New vector added | Search thesis, resume assembly | "New vector '[name]' added. Refresh your search thesis?" |
| Target vector changed on pipeline entry | Cover letter, prep deck | "This entry's target vector changed. Refresh letter/prep?" |
| Significant identity model change (new role, new calibration) | All downstream artifacts | "Your identity model has changed significantly. Review stale artifacts?" |
| Post-debrief (new round intel) | Next round's prep deck | "Round 1 debrief captured. Generate Round 2 prep?" |
| Post-rejection with pattern | Search thesis lane priorities | "Pattern detected across rejections. Adjust search strategy?" |
| New free context source added | Identity model, downstream artifacts | "New context added. Identity model updated. N artifacts may benefit from refresh." |

### UX for Refresh Prompts
- **Non-blocking notification** — badge or banner, not a modal
- **Batch review** — "3 artifacts may be stale. Review?" → show diffs for each
- **One-click accept/reject** per artifact — don't force the user to re-edit everything
- **Diff view** — show what changed and WHY ("your K8s depth correction changed this sentence")

---

## The Dependency Graph (Impact Tracing)

For "show downstream impact" to work, the app needs to know what depends on what:

```
Free Context Sources
├── AI conversation export ──→ Identity extraction (rich bootstrap)
├── Brag docs ──→ Identity extraction (structured accomplishments, PAIO-ready)
├── LinkedIn ──→ Identity extraction (structure)
├── GitHub ──→ Identity extraction (projects, evidence)
├── Old resumes/covers ──→ Identity extraction (voice, positioning history)
└── Perf reviews/recs ──→ Identity extraction (external validation, level signal)
         ↓
Identity Model
├── skills[].depth ──→ Search Thesis (skill depth map, unfair advantages)
│                   ──→ Cover Letters (skill claims)
│                   ──→ Prep Cards (gap framing scripts, stack alignment)
│                   ──→ Resume Assembly (bullet inclusion/exclusion)
│
├── search_vectors[] ──→ Search Thesis (search lanes)
│                     ──→ Pipeline (vector alignment)
│                     ──→ Resume Assembly (component selection)
│
├── self_model.arc ──→ Search Thesis (competitive moat)
│                   ──→ Prep Cards (opener scripts, career narrative)
│                   ──→ Cover Letters (positioning narrative)
│
├── preferences.matching ──→ Search Thesis (lookFor, avoid)
│                         ──→ Search execution (filter logic)
│
├── preferences.interview_process ──→ Search Thesis (interview strategy)
│                                  ──→ Prep generation (format adaptation)
│
├── generator_rules.voice ──→ Cover Letters (tone, style)
│                          ──→ Prep Cards (script voice)
│                          ──→ LinkedIn generation (voice)
│
└── skills[].calibration ──→ Search Thesis (honest framing)
                          ──→ Prep Cards (gap framing scripts)
                          ──→ Cover Letters (don't oversell)

Pipeline Entry (per-job)
├── jobDescription ──→ Prep generation (predicted questions, stack alignment)
│                   ──→ Cover letter generation (JD-specific hooks)
│                   ──→ Match analysis
│
├── positioning ──→ Cover letter generation (why-me narrative)
│               ──→ Prep cards (opener customization)
│
├── format[] ──→ Prep generation (round-type adaptation)
│
├── research ──→ Prep generation (company intel, interview signals)
│             ──→ Cover letter generation (company-specific hooks)
│
└── roundDebriefs[] ──→ Next-round prep generation
```

### Implementation Approach

Don't build a full reactive dependency graph upfront. Start with:

1. **Timestamp-based staleness detection** — each artifact records which identity model version it was generated from. When the identity model changes, compare versions.
2. **Field-level change tracking** — when a skill depth changes, flag artifacts that reference that skill.
3. **Manual triggers first, automatic later** — start with a "Refresh" button on each artifact. Add automatic suggestions once the detection logic is proven.

---

## Shepherding Principles (Design Rules)

### 1. Never Ask the User to "Improve Their Profile"
Corrections happen IN the workflow — while searching, while prepping, while debriefing. The identity model gets richer as a side effect of doing real work. No "profile completeness" score. No "finish setup" nagging.

### 2. Import, Don't Recreate
Find where career context already exists (AI conversations, brag docs, LinkedIn, GitHub, old resumes, performance reviews) and import it. Don't ask users to retype what's already been captured elsewhere. The AI conversation export is the single highest-value source — it contains pre-corrected, narrative-form career context. Brag docs are the second-highest — they contain pre-organized accomplishments that map directly to the identity model's PAIO structure.

### 3. Show Downstream Impact Immediately
When the user corrects one thing, show what changed: "3 search results filtered differently. 2 prep cards updated. 1 cover letter flagged for refresh." This makes corrections feel valuable, not tedious.

### 4. Surface the Right Correction at the Right Moment
Don't dump 50 corrections at onboarding. Surface skill depth questions during search thesis review. Surface voice corrections during cover letter editing. Surface departure context during prep generation. Each correction moment happens when the user CARES about the output it affects.

### 5. The Identity Model Is Never "Done"
It's a living document that gets richer with every interaction. The 90-day pass isn't "build your profile, then search." It's "start searching, and your profile improves as you go." Every downstream action is a potential extraction moment.

### 6. Fresh-Context Critique Is a Feature, Not Maintenance
When the identity model changes, don't just flag artifacts as stale. Offer a refresh that shows what improved: "Your cover letter for Huntress was written before you corrected your K8s depth. Here's the updated version — it now says 'I build platforms around K8s' instead of 'deep Kubernetes expertise.' Accept?" This turns maintenance into a quality improvement the user can see and feel.

### 7. Corrections Must Feel Conversational, Not Bureaucratic
"Is this right?" not "Please update this field." The UI should feel like the app is asking a genuine question, not requiring form input. Inline editing, quick toggles, one-click confirms — not modals with save/cancel buttons.

### 8. Respect the User's Time
Not every correction is worth surfacing. The app should prioritize:
- High-impact corrections (skill depth that affects search results)
- Contextual corrections (gap framing during prep, not during onboarding)
- User-initiated moments (when they're already editing something)

Skip low-impact suggestions. A user in the middle of interview prep doesn't need to know that their TypeScript depth could be refined.

---

## Connecting to Other Design Docs

| Doc | How Shepherding Connects |
|---|---|
| **doc-21** (Product Philosophy) | Shepherding is the operationalization of "seed → correct → converge" and both improvement mechanisms (explanatory correction, fresh-context critique). Free context sources are a new discovery documented here. |
| **doc-24** (Search Redesign) | Search thesis correction is the richest extraction moment. Feedback loop on results is a shepherding stage. |
| **doc-25** (Prep Gap Analysis) | Context gap workflow is already a shepherding mechanism. Round progression (debrief → next round) is a shepherding stage. |
| **Identity Schema** | Shepherding produces the corrections that populate the new schema fields (semantic depth, calibration, filter conditions) |
| **Business Model** | The engagement threshold and commitment filter are shepherding concerns — the product must make engagement feel rewarding, not mandatory |

---

## Reference Material

- Product Philosophy (backlog doc-21): extraction mechanisms, engagement threshold, seed → correct → converge, free context sources
- Search Redesign (backlog doc-24): search thesis correction flow, feedback loop, identity model gap analysis
- Prep Gap Analysis (backlog doc-25): context gap workflow, round progression, debrief capture
- Reference prep docs: Unanet HM Prep (shows how deep context produces tailored output), Blackstone R3 (shows round-over-round learning)
- Reference search docs: Job Search Parameters (shows what a fully-populated identity model enables), Pipeline Tracker (shows what a rich pipeline entry enables downstream)
