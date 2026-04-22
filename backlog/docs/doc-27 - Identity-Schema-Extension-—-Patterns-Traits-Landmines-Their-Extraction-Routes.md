---
id: doc-27
title: >-
  Identity Schema Extension — Patterns, Traits, Landmines & Their Extraction
  Routes
type: other
created_date: '2026-04-20 23:05'
---
# Identity Schema Extension — Patterns, Traits, Landmines & Their Extraction Routes

Three fields are missing from the Professional Identity Schema (v3.1) that the user has repeatedly tried to express but had no place to put: **cross-company patterns**, **temperament traits**, and **interview landmines**. This doc proposes the schema additions and — more importantly — the *extraction strategy* for each, because the schema change is the cheap part. The hard part is deciding where the data comes from.

**Core principle:** Each field has a different epistemic origin. The extraction route must match the origin or the field stays empty (and the schema change becomes dead weight).

Related: doc-21 (Product Philosophy — extraction is the bottleneck), doc-26 (Shepherding Design — extraction loops & correction flow).

---

## The Gap

The current schema (`src/identity/schema.ts`) cleanly holds:

- **Role bullets** — single outcomes at a single company
- **Philosophy entries** — principles the user holds about work
- **Interview style** — strengths/weaknesses/prep mechanics
- **Skills** — capabilities with depth/context/positioning
- **Profiles** — vector-tagged narrative blocks

It does not hold:

### 1. Patterns — repeated behaviors across companies

Examples surfaced by the user:
- Pre-sales / post-sales go-to engineer (every company)
- Formalizes functions that didn't exist (Pro Services at ThreatX, SRE team from SOC, platform at Vispero)
- Introduces new tooling ahead of the team's adoption curve
- Builds licensing/tooling for non-engineering teams who need it

Today these are scattered across role bullets or implicit in philosophy. Generators picking *one* bullet lose the cross-company signal — "you do this everywhere" is a different sentence than four separate outcome bullets.

### 2. Traits — temperament / dispositional character

Examples: "relentlessly optimistic, never loses patience, changes one thing at a time, stays calm in interrupt-heavy environments."

Sits between philosophy (how you think about work) and interview_style (how you mechanically interview). It's how the user *is* under pressure, not how they *think* or how they *interview*. It comes up as culture-fit signal, behavioral interview material, and humanizing texture in cover letters.

### 3. Landmines — interview "do not discuss" items

Examples: A10 politics, Atlas Crew runway, comp-too-early.

Currently lives in the user's head and gets re-explained per interview prep cycle. Every prep doc generated without these will need the same correction.

---

## Schema Additions (v3.2)

Three additions, designed to match existing schema patterns (`evidence`, `needs_review`, ID validation, `awareness.open_questions` shape):

```ts
interface ProfessionalIdentityV3 {
  // ... existing fields ...
  patterns?: ProfessionalPattern[]
  traits?: ProfessionalTrait[]
}

interface ProfessionalInterviewStyle {
  strengths: string[]
  weaknesses: string[]
  prep_strategy: string
  landmines?: ProfessionalLandmine[]   // NEW
}

interface ProfessionalPattern {
  id: string
  name: string
  text: string                         // narrative description
  instances: PatternInstance[]         // refs to existing roles/bullets
  tags: string[]
  evidence?: string[]
  needs_review?: boolean
}

interface PatternInstance {
  role_id: string
  bullet_id?: string
  note?: string
}

interface ProfessionalTrait {
  id: string
  text: string
  tags: string[]
  evidence?: string[]
  needs_review?: boolean
}

interface ProfessionalLandmine {
  id: string
  topic: string
  reason: string                       // "why is this a landmine"
  severity?: 'high' | 'medium' | 'low'
}
```

**Design notes:**
- `PatternInstance` references existing `role_id` / `bullet_id` rather than free text. Bullet IDs are globally unique across roles (parser enforces this at `src/identity/schema.ts:1018`), so cross-references validate cleanly without compound keys.
- `evidence: string[]` mirrors `awareness.open_questions.evidence` and `search_vectors.evidence`. Reuses existing UI/parser patterns.
- `landmines.reason` is required, not optional. Six months from now, "comp-too-early" without a reason is just a guardrail with no rationale, and gets overridden. The reason makes the landmine *defensible* to future-self.
- All three top-level/sub-level additions are **optional** — old identities migrate as missing → empty.
- Schema revision bumps from `'3.1'` to `'3.2'`. Parser, merger (`identityMerge.ts`), and persistence (`hydration.ts`, `snapshot.ts`) need updates plus the test fixture (`src/test/fixtures/identityFixture.ts`).

---

## Extraction Routes — Match the Origin

Each field has a different epistemic origin. The extraction route must match.

| Field      | Inferable from resume? | Origin                                 | Route                                            |
|------------|------------------------|----------------------------------------|--------------------------------------------------|
| Patterns   | Yes (cross-bullet)     | Comparison across existing evidence    | Extend extraction agent → propose candidates     |
| Traits     | No                     | User self-knowledge / observation       | Post-scan guided interview (async, resumable)    |
| Landmines  | No                     | User awareness of personal context      | Post-scan guided interview (async, resumable)    |
| All three  | (after onboarding)     | Lived experience in interviews          | Debrief synthesis (ongoing correction loop)      |

### Route 1 — Patterns via the existing extraction agent

The extraction agent (`src/utils/identityExtraction.ts`, `EXTRACTION_SYSTEM_PROMPT`) already sees every bullet in a single pass. Extend its output contract:

```json
{
  "summary": "...",
  "follow_up_questions": [...],
  "identity": { ... },
  "bullets": [...],
  "proposed_patterns": [
    {
      "name": "Pre/post-sales engineer",
      "instances": [
        { "role_id": "a10-staff", "bullet_id": "a10-customer-deploys" },
        { "role_id": "threatx-pe", "bullet_id": "tx-pro-services-formed" },
        { "role_id": "vispero-sre", "bullet_id": "vsp-sales-eng-support" }
      ],
      "evidence": [...],
      "rationale": "Same behavior surfaced at three companies across distinct roles"
    }
  ]
}
```

**Constraints in the prompt:**
- Minimum 3 instances across **at least 2 companies** to qualify as a proposal. Two bullets with similar verbs is not a pattern.
- Must cite specific `bullet_id`s. No "I noticed you generally tend to..." without anchors.
- Cap proposals at maybe 6 per pass to prevent over-generation.

**Surface in `ScannedIdentityEditor.tsx`** as a candidates list — same UX shape as bullet review. User accepts (`needs_review: false`), edits the name/text/tags, or rejects. Accepted patterns land in `identity.patterns[]`.

This is the highest-leverage move because patterns are the *only* field where the LLM has real signal from the resume.

### Route 2 — Traits & landmines via post-scan guided interview

After scan completes and the extraction draft is reviewed, run a **short guided interview** before enrichment begins. Not a blocking modal — model the questions as `awareness.open_questions` entries with structured tags so they render in a dedicated "deepen your identity" surface that can be revisited.

**Seed questions (~6, expandable):**

Trait elicitation:
1. "How do you behave when something breaks at 2am?" → trait
2. "Where do you stay calm that other engineers don't?" → trait
3. "What's a habit of mind that's served you across roles?" → trait

Landmine elicitation:
4. "Are there topics you don't want interviewers to ask about? Why?" → landmine
5. "Are there things about a previous role you'd rather not bring up?" → landmine

Philosophy gap-fill (no schema change needed, but same flow):
6. "When have you led without being the manager?" → philosophy entry

**Why async-resumable:**
- Reflection doesn't happen on demand. Forcing a modal will get rushed answers or skipped entirely.
- Matches `awareness.open_questions` semantics already in the schema (persistent, `needs_review`, no expiry).
- User answers 2 now, 3 later, 1 next week — every answer enriches the model.

**Implementation hook:** Extend `EXTRACTION_SYSTEM_PROMPT` to seed `follow_up_questions` with these (or a curated subset based on what's missing in the identity), and wire `IdentityEnrichmentPage` to surface a "Deepen Identity" tab alongside the per-skill enrichment that already exists.

### Route 3 — Debrief synthesis as the ongoing correction loop

This is the long-game route. Patterns and traits *actually* surface organically from real interview debriefs — the user just lived a specific experience and knows what landed, what didn't, what pressures came up.

After each debrief (debrief plumbing referenced in `src/test/debriefPatterns.test.ts` and doc-26):
- LLM scans the debrief for trait/pattern/landmine signals
- Proposes additions or edits to existing identity entries with `needs_review: true`
- User confirms in a review step (don't silently mutate)

**Threshold:** Don't propose after a single debrief. Wait until N=2-3 debriefs reference the same trait/pattern before surfacing. This avoids one-off observations becoming permanent identity claims.

This is the "correction > creation" loop (doc-21 product philosophy) applied to identity itself. The model gets smarter every interview.

---

## Why Not Alternatives

### Why not a dedicated "Reflection" workspace

A new workspace adds discovery cost, AppShell icon real estate, store wiring, and routing — all for a low-frequency activity (first scan) or a derived activity (debrief synthesis). The scan flow already has user attention in reflection mode. Reuse it.

### Why not extend the extraction prompt to hallucinate traits/landmines from the resume

You'd get garbage. An LLM reading a resume has no basis to claim "stays calm under pressure" — it will refuse or confabulate from job titles. Worse, it erodes trust in the whole extraction pass. **Only extract what the resume actually contains evidence for; ask for the rest.**

### Why not just tag bullets with `pattern: ["pre-sales"]` and derive patterns at read time

You lose the narrative. "This happened 4 times across these companies" is a different sentence than 4 bullets with the same tag. A top-level patterns array with explicit cross-references gives generators the cross-company framing as a first-class object, not an aggregation.

---

## Trade-offs to Name

1. **The interview pass adds a step.** Users wanting instant gratification after scan will feel it. Mitigate by framing as optional-but-recommended and resumable. The "extraction is the bottleneck" thesis (doc-21) argues this cost is worth paying — this *is* that bottleneck made explicit.

2. **Pattern auto-proposal can over-generate.** The LLM will find weak "patterns" that are just two bullets with similar verbs. The 3-instance / 2-company threshold is the first defense. Accept-or-reject UX is the second. Surface them as **candidates**, never as facts.

3. **Debrief-driven updates need a staging area.** Don't let each debrief silently mutate identity. The same `needs_review` pattern as `search_vectors` and `awareness.open_questions` — debrief surfaces proposals; user confirms.

4. **Generator wiring is the real work.** Schema changes are nothing without `prepIdentityContext.ts`, `identitySearchProfile.ts`, `linkedinProfileGenerator.ts`, and the resume assembler reaching into `patterns`/`traits`/`landmines`. Plan for follow-up commits per generator. Schema sprawl that downstream generators ignore is worse than no schema change.

5. **Schema revision bump is non-trivial but well-scoped.** Three additions, all optional, with established precedent shapes. Parser/merger/persistence/fixture updates are mechanical. Tests in `identityMerge.test.ts`, `identityFixture.ts`, `professionalIdentity.test.ts`, `persistence.test.ts` need new cases.

---

## Minimal First Cut

Suggested commit sequence:

1. **Schema bump** — add `patterns`, `traits`, `interview_style.landmines` to `src/identity/schema.ts`. Parser + merger + fixture + persistence migration. Tests pass with empty arrays.
2. **Extraction agent — pattern proposals** — extend `EXTRACTION_SYSTEM_PROMPT` and the response parser to emit `proposed_patterns`. Wire into `ScannedIdentityEditor.tsx` as a candidates review section. Accept/reject/edit lands in `identity.patterns`.
3. **Seed follow-up questions** — extend extraction prompt to seed `follow_up_questions` with the trait/landmine/philosophy seeds. Surface in a "Deepen Identity" view (extension of `IdentityEnrichmentPage` or sibling route).
4. **Generator integration** — per-generator commits teaching `prepIdentityContext`, `identitySearchProfile`, `linkedinProfileGenerator`, and the resume assembler to pull from the new fields.
5. **Debrief synthesis** — defer until the debrief loop lands. Then add the synthesis pass with `needs_review` proposals.

Each step is independently shippable. Empty patterns/traits/landmines degrade gracefully (generators just don't cite them). The schema can land before the UI catches up.

---

## Open Questions for Implementation

- Should `proposed_patterns` from extraction be persisted separately (e.g., `identity.patterns[]` with `needs_review: true`) or held in transient extraction state until the user reviews them? Persisting matches the `awareness.open_questions` pattern; transient avoids polluting the model with rejected proposals.
- For the post-scan interview, do trait/landmine questions live in `awareness.open_questions` (with a category tag) or in a parallel structure? Reusing `awareness` is cheaper but conflates "questions to research" with "questions to elicit data." A separate `prompts` collection might be cleaner long-term.
- Pattern instances reference `bullet_id` — what happens when a bullet gets deleted or a pattern's instance count drops below the threshold? Auto-flag for review? Auto-drop? Probably review-flag to give user a chance to add new instances.
