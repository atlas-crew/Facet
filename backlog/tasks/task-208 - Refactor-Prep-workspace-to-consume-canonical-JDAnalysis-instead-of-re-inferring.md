---
id: TASK-208
title: Refactor Prep workspace to consume canonical JDAnalysis instead of re-inferring
status: To Do
assignee: []
created_date: '2026-05-03 22:30'
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
  - backlog/docs/doc-30 (Pipeline Depth — Rounds, Research Tiers, and the Calendar)
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
- [ ] Workstream 1 audit complete, decisions surfaced and locked
- [ ] PrepDeck data model includes `jdAnalysisId` reference
- [ ] `prepGenerator.ts` reads from canonical JDAnalysis, not from raw JD text or re-inferred analysis
- [ ] Existing prep features (homework, live, anchor stories, conditionals) preserved
- [ ] Stale-detection UI surfaces when source JDAnalysis updates after deck generation
- [ ] Match-workspace report and Prep deck content for same pipeline entry are internally consistent
- [ ] Test coverage validates prepGenerator no longer reads raw JD text directly
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
TBD — finalize after Workstream 1 audit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
This insight surfaced from reviewing a real Match-workspace JDAnalysis output for a Senior Platform Engineer role. The user observed that the analysis was producing comprehensive enough output to drive Prep generation, not just inform it.

Original Slack-equivalent quote from the conversation: "we actually weren't expecting the JD analysis to be so comprehensive it could drive interview prep but that's actually what its doing. The current interview prep workspace is inferring a lot of this, probably not as well and like you said risk of inconsistency."

The architectural claim being staked: any per-listing artifact should read from canonical JDAnalysis as a projection, not re-derive its own interpretation. See companion doc capturing the broader principle.
<!-- SECTION:NOTES:END -->
