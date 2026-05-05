---
id: TASK-208
title: >-
  Refactor Prep workspace to consume canonical JDAnalysis instead of
  re-inferring
status: In Progress
assignee: []
created_date: '2026-05-03 22:30'
updated_date: '2026-05-05 16:23'
labels:
  - prep
  - refactor
  - architecture
  - canonical-projections
dependencies:
  - decision-2
  - decision-4
  - decision-5
  - task-209 (PrepPage typecheck fix is a precondition for clean baseline)
references:
  - src/utils/prepGenerator.ts
  - src/types/prep.ts
  - src/store/prepStore.ts
  - src/routes/prep/PrepPage.tsx
documentation:
  - docs/architecture/facet-workspace-topology.md
  - docs/architecture/identity-canonical-data.md
  - backlog/docs/doc-25 (Prep Workspace Gap Analysis)
  - backlog/docs/doc-28 (Prep Workspace Structural Additions)
  - >-
    backlog/docs/doc-30 (Pipeline Depth — Rounds, Research Tiers, and the
    Calendar)
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

Empirical observation while reviewing a real Match-workspace JDAnalysis output for a Senior Platform Engineer role: the canonical JDAnalysis is rich enough to drive Prep generation directly, not just inform it. Specifically, JDAnalysis already produces:

- Matched vectors with thesis fit explanations and per-vector evidence
- Skill matches with `userDepth`, `requirementStrength`, `matchQuality`, and `presentationGuidance`
- `strengthsToLead`, `triggeredPrioritize`, `triggeredAvoid`, `relevantAwareness`
- Advantages with claims and supporting evidence per requirement
- Gaps with severity and reason
- Positioning recommendations
- Gap focus framings
- Warnings (role-specific cautions)

This is most of what Prep currently re-infers from raw JD + identity + resume in `prepGenerator.ts`. Re-inferring downstream of canonical analysis is the same anti-pattern that drove the JD analysis consolidation refactor (four duplicate analyses across Match, Build, Prep, Letters). The fix shape is the same: canonical core, projections downstream.

## Goal

Refactor Prep generation so it reads from canonical JDAnalysis on the linked pipeline entry, with Prep adding the layers JDAnalysis does not produce:

- **Anchor stories selected and matched to JD requirements** — the JDAnalysis identifies which evidence applies; Prep picks specific identity stories and structures them as rehearsable narratives.
- **Talking points crystallized into rehearsable form** — `strengthsToLead` and advantages claims become drillable cards with delivery cues, not just analytical statements.
- **Predicted hard questions with prepared answers** — JDAnalysis flags `watchOuts` and gaps; Prep drafts the actual 30/60/90-second answers.
- **Gap-framing scripts** — JDAnalysis produces `gapFocus` framings; Prep turns each into a deliverable script.
- **Meta-coaching layer** (per doc-25) — strategy notes, framing logic, "why this works" annotations.

Per doc-30, Prep also needs a role-level / round-level split (see open decisions below).

## Scope

**In scope (Workstream 1 — Audit):**

- Map current `prepGenerator.ts` to identify which fields it currently infers vs. which fields are derivable from JDAnalysis
- Map current `PrepDeck` and `PrepCard` types to identify which fields are JDAnalysis-projected vs. Prep-original (anchor stories, scripts, meta-coaching, drilling content)
- Inventory current generation prompt structure to identify the rewrite scope
- Audit how Prep consumes JD context today (raw JD text? PipelineEntry.jdText? PipelineResearchSnapshot.jobDescriptionSummary?) and identify the migration path to `pipelineEntry.jdAnalysisId`
- **Triage existing queued prep tasks against the canonical-projections refactor.** Several queued tasks (task-136, task-137, task-139, task-140, task-146, task-170, task-171, task-173, task-177, task-179, task-180) were filed before this architectural shift. The audit must classify each as: **survives** (work is still needed and unchanged), **redirected** (the user-facing capability stays but the implementation changes — the task description needs rewriting), or **subsumed** (the work is now produced by canonical JDAnalysis and the task can close). Output: a triage list informing post-refactor cleanup. Initial guess (subject to audit): drilling/format/intel-capture tasks likely survive (139, 170, 171, 177, 180); narrative/takeaway/skill-mapping tasks likely subsumed or redirected (136, 137, 146, 173, 179); model evaluation reframes (140). Confirm or correct during audit.

**In scope (Workstream 2 — Implementation):**

- Add JDAnalysis ID reference to PrepDeck (analogous to how Bundle 2 added resume/letter ID references to PipelineEntry)
- Refactor `prepGenerator.ts` to read JDAnalysis from canonical store and project from it rather than re-inferring
- Update prompts to consume JDAnalysis as structured input rather than raw JD text
- Preserve all existing Prep-original content fields (anchor stories, conditionals, scripts, meta-coaching)
- Add stale/drift detection: if JDAnalysis updates after a deck is generated, surface this in the Prep workspace

**Out of scope (deferred to follow-up):**

- Role-level / round-level split (see Open Decisions)
- Cross-cutting principle generalization (see Open Decisions)
- Migration of existing decks (pre-launch, no users to lose data from — fresh decks only)

## Open Decisions to Resolve in Audit

1. **Role-level vs round-level prep split.** Should Prep model "generic prep for the role" as a separate canonical entity from "per-round overlays," or model rounds as projections of role-level prep with override semantics? My current read: separate decks that read from role-level prep, with copy-on-edit semantics — same shape as Bundle 2's resume snapshots. Decide during audit.

2. **PrepDeck ↔ PipelineEntry cardinality.** Currently a deck references one pipeline entry. Under role-level/round-level split, does each round get its own deck, or does one deck have round-tabs? Architectural shape decision needed.

3. **Migration policy for existing decks.** Pre-launch, my read is discard. Existing decks were generated against ad-hoc JD inference; not worth the migration complexity to reconcile against canonical JDAnalysis. Confirm pre-launch posture allows this.

## Why Not Now

JD Analysis Bundle 1 has shipped. JD Analysis Bundle 2 (Workstream 3 — first-class cover letter entities + paired snapshots) is in flight. Cover letter agent has cleanup commits queued. Pulling either agent off current work to start Prep refactor would introduce coordination cost without enabling parallel delivery. File now to capture insight before it evaporates; pick up after Bundle 2 lands.

**Update (2026-05-03):** The cover letter agent is also planning to migrate Letters to consume canonical `jdAnalysis` before proceeding to Workstream 4. That work locks the canonical-consumption test guardrail (per doc-36 cleanup item #4). Task-208 references that guardrail rather than re-locking it from scratch — Prep follows the same pattern Letters establishes.

**Update (2026-05-03 23:55):** Letters refactor shipped in commit 449ac24. Sequencing is now Letters (shipped) → Build/Workstream 4 (next) → task-208 Prep (after Build). Reasons: Build is mechanically simpler than Prep, Build's work retires legacy `jdAnalyzer.ts` removing a foot-gun, Prep needs three open architectural decisions resolved before implementation. task-209 (PrepPage typecheck fixes) is the precondition that should land before task-208 starts.

## Success Criteria

- `prepGenerator.ts` reads JDAnalysis from `pipelineStore.getEntry(entryId).jdAnalysisId` rather than inferring from raw JD
- Prep deck content for a given pipeline entry is consistent with the Match-workspace report for the same JD (no contradictions between strengths-to-lead, gap framings, or skill positioning)
- Existing Prep features (homework mode, live cheatsheet, anchor stories, conditionals) survive unchanged
- Stale-detection UI surfaces when JDAnalysis is updated after deck generation
- Test coverage validates that prepGenerator no longer reads raw JD text directly

## Implementation Order

1. **Workstream 1 (Audit)** — read-only mapping pass, classify current fields, surface decisions, propose data model changes
2. **Stop and review** with audit findings, lock open decisions
3. **Workstream 2 (Implementation)** — deck ↔ JDAnalysis ID linkage, prepGenerator refactor, prompt rewrite, stale detection
4. **Workstream 3 (Role-level / round-level split)** — separate bundle, gated on doc-30 round model implementation
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Workstream 1 audit complete, decisions surfaced and locked
- [x] #2 Audit produces triage list classifying queued prep tasks (task-136, 137, 139, 140, 146, 170, 171, 173, 177, 179, 180) as survives/redirected/subsumed, with rationale per task
- [ ] #3 PrepDeck data model includes `jdAnalysisId` reference
- [ ] #4 `prepGenerator.ts` reads from canonical JDAnalysis, not from raw JD text or re-inferred analysis
- [ ] #5 Existing prep features (homework, live, anchor stories, conditionals) preserved
- [ ] #6 Stale-detection UI surfaces when source JDAnalysis updates after deck generation
- [ ] #7 Match-workspace report and Prep deck content for same pipeline entry are internally consistent
- [ ] #8 Test coverage validates prepGenerator no longer reads raw JD text directly
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Workstream 1 audit only: (1) confirm Prep baseline and precondition status, (2) map current Prep generation inputs and duplicated JD inference, (3) map PrepDeck/PrepCard fields into JDAnalysis-projected vs Prep-original, (4) compare canonical JDAnalysis coverage and missing Prep-only layers, (5) triage queued prep tasks, then stop for decision lock before implementation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
This insight surfaced from reviewing a real Match-workspace JDAnalysis output for a Senior Platform Engineer role. The user observed that the analysis was producing comprehensive enough output to drive Prep generation, not just inform it.

Original Slack-equivalent quote from the conversation: "we actually weren't expecting the JD analysis to be so comprehensive it could drive interview prep but that's actually what its doing. The current interview prep workspace is inferring a lot of this, probably not as well and like you said risk of inconsistency."

The architectural claim being staked: any per-listing artifact should read from canonical JDAnalysis as a projection, not re-derive its own interpretation. See companion doc capturing the broader principle.

Audit started. Baseline check: pnpm typecheck currently passes; TASK-209 remains open in backlog but its recorded createDeck/setActiveDeck errors are not present in the current working tree.

Workstream 1 audit findings:
- Current Prep generation still sends raw jobDescription and asks the model to derive likely interview themes, stackAlignment, gap-framing, landmines, market-rarity notes, and role/company motivation. This is the duplicate analysis path to retire.
- Current Pipeline generation path gates only on selectedEntry.jobDescription and does not require/resolve selectedEntry.jdAnalysisId. Regeneration uses the deck's stored jobDescription, so it can continue re-inferring even if Pipeline analysis is stale or missing.
- PrepDeck has pipelineEntryId, pipelineRoundId, identityVersion, identityFields, stalenessReview, generatedAt, and rich Prep-original fields, but no jdAnalysisId/jdAnalysisGeneratedAt/jdAnalysisModelVersion snapshot fields yet.
- Canonical JDAnalysis already covers requirements, skillMatches, strengthsToLead, advantages, gaps, gapFocus, watchOuts, positioningRecommendations, matched vectors, evidence mapping, matched keywords, and drift inputs. Prep should project stackAlignment, gap cards, landmines, role/company framing, and warnings from those fields instead of asking the model to rediscover them from the JD.
- Prep-original layers that should remain generated by Prep: rehearsable scripts, story selection/variants, keyPoints/beat sheets, delivery coaching, question drills, conditionals, prior-round remediation, contextGaps, and interviewer-specific cards from user-sourced round.interviewers/T3 dossiers.
- Existing match-source generation path creates Prep decks without a pipeline entry. This conflicts with the current topology for job-specific artifacts. Recommended decision: retire direct Match-to-Prep generation and require Promote/Create Pipeline Entry first, matching Letters.
- Recommended implementation shape: keep prepGenerator pure. PrepPage or a small prepGenerationContext helper should resolve PipelineEntry + JDAnalysis + drift status from stores, pass jdAnalysis as structured input, and block generation when missing/stale. Do not import stores directly into prepGenerator.
- Stale detection should use getJdAnalysisDriftStatus against the linked Pipeline entry and current identity version. PrepDeck should record jdAnalysisId and enough generation metadata to show stale when the entry points to a newer/different/stale analysis.

Queued prep task triage:
- TASK-136 redirected: alternative narrative support survives, but generation should choose alternatives from JDAnalysis evidenceMapping/advantages + identity stories, not raw-JD inference.
- TASK-137 redirected/subsumed: one-liner takeaways can be generated as Prep-original scriptLabel/closer copy, but their role/company specificity should derive from JDAnalysis strengths/positioning.
- TASK-139 survives: technical drills and answer templates are Prep-original rehearsal artifacts, seeded by JDAnalysis requirements/watchOuts/gaps.
- TASK-140 redirected: model evaluation should compare canonical-JDAnalysis projection quality, not raw JD prompt quality. Re-run after task-208 implementation.
- TASK-146 redirected: multi-role opener survives, but relevance should be seeded by JDAnalysis evidenceMapping/top assets rather than Prep re-ranking roles from raw JD.
- TASK-170 mostly subsumed/stale: contract validation types/UI already exist in current code. Remaining work, if any, should be re-filed narrowly as telemetry or JDAnalysis-projection guardrails.
- TASK-171 partly subsumed/redirected: PrepInterviewer exists and is gated by user-sourced round.interviewers. CompanyIntel is not present; if needed, it belongs to Pipeline research/T3 dossiers first, with Prep rendering/projection after.
- TASK-173 subsumed/redirected: stack alignment should be projected from JDAnalysis.skillMatches.userDepth/matchQuality/presentationGuidance, not from a separate Prep skill-depth mapping. Keep only if a display mapping from SkillMatch to PrepStackAlignmentConfidence is still needed.
- TASK-177 mostly subsumed/stale: keyPoints, beat sheet/glance labels, live mode rendering, and homework reveal exist. Remaining work should be narrowed to prompt/projection wording after canonical JDAnalysis input.
- TASK-179 survives: storyVariants are Prep-original and still useful; source candidate stories from JDAnalysis evidenceMapping/advantages.
- TASK-180 survives: pushbackScript is Prep-original delivery UX; seed from JDAnalysis watchOuts/gaps and prior-round debriefs.
Open decisions for user lock:
1. Should direct Match-to-Prep generation be retired now, requiring pipeline promotion before Prep generation?
2. Should PrepDeck store only jdAnalysisId, or also jdAnalysisGeneratedAt/modelVersion/jdTextHash at generation time for clearer stale messages?
3. Should task-209 be closed as stale now that typecheck passes and createDeck/setActiveDeck exist?

Decision locks have been split into child implementation tasks: TASK-208.1 retires direct Match-to-Prep generation behind Pipeline promotion; TASK-208.2 persists JDAnalysis generation metadata on PrepDeck; TASK-208.3 passes canonical JDAnalysis projection into pure Prep generation and depends on 208.1/208.2.
<!-- SECTION:NOTES:END -->
