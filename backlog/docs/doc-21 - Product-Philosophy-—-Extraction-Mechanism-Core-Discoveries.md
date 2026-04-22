---
id: doc-21
title: Product Philosophy — Extraction Mechanism & Core Discoveries
type: other
created_date: '2026-04-16 11:00'
updated_date: '2026-04-19 05:24'
---
# Product Philosophy — Extraction Mechanism & Core Discoveries

Empirically validated discoveries from 6+ months of using the Facet methodology. These aren't hypotheses — they're patterns observed through actual job searching, interview prep, career coaching, and salary negotiation.

---

## The Foundational Insight

**Extraction is the bottleneck, not generation.**

Everything downstream — resume assembly, interview prep, job search vectors, recruiter cards, comp negotiation — depends on how much context is extracted from the user. The AI can generate beautiful outputs from thin context, but they'll be generic. The compound context IS the product, and extraction is how you build it.

Whether Facet works for a given user depends entirely on whether the product extracts enough context from them to power all downstream features. This is the single most important product design challenge.

---

## Discovery 1: Correction > Creation

When the AI generates a resume draft with assumptions and incorrect details, the user corrects it. In correcting, they retell the story with MORE specificity and detail than they would have written from scratch. Each iteration pulls out details the user didn't think to mention.

**This is a deliberate extraction mechanism, not a bug.**

Implications for product design:
- Present AI-generated assumptions for the user to correct, rather than blank fields to fill
- Multiple passes are a feature, not friction
- Each correction enriches the component library with details that wouldn't have surfaced otherwise
- The "generate → correct → regenerate" loop is the core UX pattern

---

## Discovery 2: Explanatory Correction Produces Level-Correction

Multiple passes through the extraction loop surface a professional narrative at a HIGHER level than the user would self-report. The specific mechanism:

1. AI generates resume with assumptions
2. User sees an assumption or oversimplification
3. User explains WHY they did what they did — not just "that's wrong" but the reasoning, constraints, and decision-making
4. AI realizes the judgment was more sophisticated than the resume reflected
5. AI level-corrects: "you described this as senior work but the scope, autonomy, and decision-making you just explained is staff-level"

**The correction isn't just factual — it's explanatory.** Two examples:

- **Factual correction:** "That's wrong, I used Fargate not EC2" → fixes a fact, doesn't reveal judgment
- **Explanatory correction:** "I chose Fargate because I identified that per-tenant VPCs were costing $120K/mo and I designed a shared-compute architecture with VPC peering for isolation — the migration saved $60K/mo" → reveals the engineering judgment the resume undersold

The explanatory correction reveals decision-making sophistication the user wouldn't have written unprompted. **When someone writes from scratch, they write at the level they think they are. When they correct an underestimate, they explain themselves into the level they actually are.**

This has profound implications:
- Facet doesn't just format what users already know about themselves — it reveals what they don't
- The product creates genuine new value through the extraction process itself
- Level-correction is a powerful differentiator: no competitor does this because they don't have the iterative extraction loop
- The AI must generate output that's close enough to be worth correcting but imperfect enough to trigger the explanatory response

---

## Discovery 3: Fresh-Context Self-Critique (The Author/Editor Split)

When the AI re-reads its OWN previous output in a new context window — without remembering it was the author — it critiques sharply and produces a significantly better version. This is the "editor vs. author" phenomenon: authors are blind to their own work's weaknesses; a fresh reader sees them immediately.

**The specific mechanism:**

1. AI generates a resume or LinkedIn bio
2. Time passes. New context accumulates — user expressed new goals, corrected other assumptions, identity model deepened
3. User shows the AI its own previous output in a new context window
4. AI reviews with fresh eyes + updated understanding of the user's goals and identity
5. AI critiques sharply — sees weaknesses it was blind to as the author
6. AI produces a significantly improved version, optimized for the user's CURRENT target

**This produced measurable results:** A LinkedIn bio rewritten with a fresh-context pass optimized for "founding engineer" started producing highly relevant recruiter inbound within 24 hours.

**Why this works:** The AI-as-author is constrained by the reasoning path that produced the original output. The AI-as-editor starts from the output itself and evaluates it against the current best understanding of the user. These are structurally different cognitive processes. The editor catches problems the author literally cannot see.

**Product implications:**

The architecture should intentionally create opportunities for the AI to review its own prior output with fresh context:

- **"Refresh" action** on existing resumes/bios/prep — re-evaluate with latest identity context but without memory of authoring the original
- **Periodic self-critique** — when the identity model changes (new corrections, new depth data, new goals), prompt a fresh-context pass on existing artifacts
- **Multi-model review** — use a different model or temperature setting for the critique pass to maximize the "fresh eyes" effect
- **Version diff** — show users what changed and WHY, so the improvement is visible and educational

This is not the same as "regenerate." Regeneration starts from scratch. Fresh-context critique starts from the existing output and improves it — preserving what works, fixing what doesn't, and reoptimizing for current goals.

---

## Discovery 4: The Method Is Free; The Product Is the Shepherd

The Facet Method page (atlascrew.dev/facet-method.html) and DIY templates are given away freely. This costs nothing because the real barrier isn't knowing what to do — it's doing it when faced with a blank chat prompt.

Facet's value proposition is NOT "we have a secret methodology." It's "we structure the engagement model so you naturally go through the extraction → iteration → refinement loop without having to design the process yourself."

The DIY kit proves the method works. Facet makes the method accessible to people who wouldn't run it manually.

---

## Discovery 5: LinkedIn Proves Output Quality Is Measurable

Tuning a LinkedIn bio for the "founding engineer" vector produced highly relevant inbound from recruiters within 24 hours. This is partially explained by recruiter-side AI matching against the precise positioning, but the key insight is:

**When the positioning is precise enough, the right opportunities find you.**

This validates that the extraction → assembly pipeline produces outputs with real-world measurable impact, not just "better-looking resumes."

---

## Discovery 6: Documentation Amplifies But Isn't Required

The founder's best results came from feeding 170 pages of project documentation (architecture decisions, technical references, product READMEs) that the AI then used in interview prep materials. This documentation was the highest-signal input.

However, the iterative correction mechanism can extract a useful amount of context without that volume. The product must be designed to:
- Pull depth through the correction loop (primary mechanism)
- Optionally accept uploaded documentation for users who have it (amplifier)
- Not require documentation volume that most users won't have

---

## Discovery 7: Cover Letters Convert Cold Applications

**The strongest signal yet.** Recruiters have literally cited specific things from AI-generated cover letters as reasons for reaching out on cold applications. Cold applications now work confidently as a channel.

The cover letters required four layers of compound context:
1. **User identity** — the career model, positioning vectors, archetype
2. **The job** — specific requirements, seniority signals, technical stack
3. **The company** — culture, recent decisions, technical challenges, interview style
4. **Voice notes** — observations about the user's personal writing voice and tone

This four-layer context produced natural-sounding output that made LinkedIn's formulaic cover letter generator look like a template fill-in. The key differentiator: the letters sounded like a specific person talking about a specific opportunity at a specific company — because they were assembled from structured context about all three, written in the user's actual voice.

Combined with deep research that identifies jobs where the user has "unfair advantage," cold outreach became a reliable channel, not a lottery ticket.

**Why this matters for the product:**
- Cover letter generation is a high-visibility proof point — recruiters literally tell you it worked
- It demonstrates that compound context (user + job + company + voice) produces qualitatively different output than single-context tools
- It validates the "unfair advantage" job search concept: targeting the right opportunities AND presenting well for them is a multiplier, not just an addition
- Voice capture/modeling should be a first-class feature, not an afterthought

---

## Voice Extraction Strategy

Voice is the hardest layer to extract — and the most defensible. It's what makes cover letters sound like a person, not a template. LinkedIn has access to user + job + company context too; what it doesn't have is voice.

### Key Insight: Voice Is a Byproduct of the Correction Loop

When a user rewrites "Spearheaded the implementation of a cloud-native observability platform" to "Built the monitoring stack from scratch because nobody could debug anything," that correction carries two signals: a factual correction AND a stylistic preference. Every correction enriches BOTH the component library and the voice model.

Voice doesn't need a separate extraction step. It emerges naturally from the same generate → correct → regenerate loop that builds the career identity model. The engineering challenge is making the system learn from those deltas — identifying patterns across corrections (informal language, avoids corporate jargon, leads with outcomes not process, uses humor, etc.) and applying them forward into generation.

### Cold-Start Solution: Seed with the Founder's Voice

Same pattern as the resume template — seed the product with a real, validated artifact. The founder's voice (direct, specific, no corporate-speak) is a good default for the initial target audience of senior engineers.

Users get a working voice immediately. Correction deltas personalize it over iterations:
- First cover letter: ~70% founder voice / 30% user
- By the third: mostly theirs
- The user never has to fill out a "describe your communication style" form

As the product expands across professions, this may evolve into multiple default voice profiles (engineer, attorney, physician) — but for launch, one good default bridges the cold-start gap.

### Extraction Difficulty Hierarchy

Each layer is harder to extract AND harder to replicate:

| Layer | Difficulty | Competitor Landscape |
|---|---|---|
| **Facts** (roles, dates, skills) | Easy | Every competitor does this |
| **Context** (what you did, metrics, decisions) | Medium | Requires the correction loop; few attempt it |
| **Patterns** (archetype, cross-role themes, level-correction) | Hard | Requires multiple iterations; no competitor does this |
| **Voice** (how you talk about your work) | Hardest | Emerges from correction deltas; nobody is attempting this |

Voice is the top of the stack — the most defensible and the most valuable for output quality.

---

## The Engagement Threshold

The product requires a certain level of user engagement and commitment to work. The reference interview prep docs (Unanet HM prep, Blackstone R3 prep) prove that with deep enough context, every downstream output is dramatically better than any competitor. But "deep enough" requires the user to invest: build out career history with real detail, go through multiple correction cycles, be honest about gaps/depths, populate preferences and voice.

The $149/90-day pass is a commitment filter — buyers are in an active job search with real urgency. They'll engage. The risk is users who load a resume, get a decent but not magical first pass, and stop before the correction cycles compound.

**The UX must make corrections feel like visible progress, not friction.** Each correction should show immediate impact downstream: "you fixed your Kubernetes depth → your search thesis updated → your prep cards now correctly frame K8s."

---

## Core UX Philosophy: Seed → Correct → Converge

This pattern applies at every layer of the product:

- **Don't give users a blank form** — give them something real to react to
- **Don't ask users to describe themselves** — show them a description and let them fix it
- **Don't ask users what voice they want** — give them a voice and let them drift toward their own
- Every layer starts with a working default and converges toward the user through corrections
- The AI generates, the user corrects, the system learns
- The product gets more personal with every interaction — no settings pages, no questionnaires

---

## The Two Improvement Mechanisms (Resume/Bio Quality)

### Mechanism A: Explanatory Correction → Level-Correction
The user corrects an assumption by explaining their reasoning. The explanation reveals judgment the resume undersold. The AI level-corrects upward.

**Example:** AI writes "managed Kubernetes deployments." User corrects: "I chose Fargate over K8s because per-tenant VPCs were bleeding $120K/mo — I designed shared-compute with VPC peering for isolation." AI responds: "that's staff-level infrastructure decision-making, not senior ops work."

**When to trigger in product:** During initial resume building, during identity extraction, during search thesis generation (skill depth correction).

### Mechanism B: Fresh-Context Self-Critique → Reoptimization
The AI reviews its own previous output without remembering it authored it. With fresh eyes and updated context, it critiques sharply and produces a better version.

**Example:** LinkedIn bio written 2 weeks ago. User's goals have shifted to "founding engineer." AI reviews bio in new context: "this undersells the solo shipping speed and overemphasizes team leadership — for founding engineer positioning, lead with the 4-platforms-in-11-months story." Rewritten bio produces relevant inbound within 24 hours.

**When to trigger in product:**
- When identity model changes significantly (new corrections, new goals)
- When user switches target vector
- As a periodic "refresh" action on stale artifacts
- After search thesis generation reveals new positioning angles

Both mechanisms are extraction multipliers. Mechanism A extracts depth FROM the user. Mechanism B extracts quality from the AI's own prior work. Together they create a ratchet: each pass is strictly better than the last.

---

## The 4-Phase Pipeline (From the Facet Method)

Each phase's output feeds the next, building compound context:

1. **Candidate Profiling** — Feed everything: resume, tech docs, project READMEs. Identify archetype, 2-3 positioning angles, strength/gap analysis
2. **Market Research** — Two passes: builder-friendly interview formats + stack/domain overlap. 20+ targets ranked by signal convergence
3. **General Study Guide** — Reusable prep artifact: variant scripts per angle × question, deep dives, key numbers, navigable under pressure (grid layout, keyboard shortcuts, timer)
4. **Per-Listing Analysis** — Fit map, gap framings, predicted hard questions, company-specific hooks

Each phase in the manual process maps to a workspace in the Facet product:
- Phase 1 → Build (resume engine with vectors)
- Phase 2 → Research + Pipeline (search + tracking)
- Phase 3 → Prep (interview prep decks)
- Phase 4 → Letters (per-listing cover letters) + JD analysis

---

## Product Design Imperative

**The product succeeds or fails on extraction quality.**

The onboarding and resume-building flow must be designed to trigger the correction → retelling → depth cycle, not just accept what users type in the first pass. This means:

1. AI generates a first-pass profile from minimal input (resume upload, LinkedIn import, or short Q&A)
2. The generated profile contains assumptions — some right, some wrong
3. User corrects the wrong assumptions, and in doing so, provides richer context
4. AI regenerates with the corrections, surfacing new patterns and connections
5. Repeat until the user says "yes, that's me"

Each cycle enriches the component library. The "finished" state is when the user has a career identity model rich enough to power all downstream features — and they got there through correction, not through filling out a 50-field form.

**Voice capture** should be integrated into the extraction loop — the AI should learn how the user talks about their work, not just what they've done. This powers natural cover letters and recruiter cards that sound like the person, not like a template.
