---
id: TASK-44
title: >-
  Reconcile stale documentation: PIPELINE_PREP_SPEC +
  vector-resume-v0.2-feature-reference
status: In Progress
assignee:
  - '@codex'
created_date: '2026-03-10 03:54'
updated_date: '2026-05-28 15:16'
labels:
  - documentation
  - stale
milestone: m-9
dependencies: []
references:
  - docs/reference/vector-resume-v0.2-feature-reference.md
  - docs/NAVIGATOR.md
  - docs/reference/ai-feature-audit.md
  - src/persistence/README.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context

Two stale reference documents need reconciliation against current shipped state. Merged 2026-05-08 (TASK-221 absorbed; closed as duplicate).

### Doc 1 — `docs/PIPELINE_PREP_SPEC.md`

Claims the Pipeline/Prep suite is "Ready for implementation" but `src/routes/pipeline` and `src/routes/prep` exist, are shipped, and have undergone substantial post-spec evolution (doc-30 rounds + research tiers, doc-36 canonical-projections refactor, task-208 Prep migration to canonical JDAnalysis).

### Doc 2 — `docs/reference/vector-resume-v0.2-feature-reference.md`

Last edited 2026-03-13. Indexed in `docs/NAVIGATOR.md` as the "Current feature inventory for the shipped Facet product surface" — that promise no longer holds. From the 2026-05-05 `/doc-claim-validator` pass:

**Outright failures (deleted files):**
- Line 61 references `src/utils/jdAnalyzer.ts` — deleted by commit `0165a75 refactor(build): retire legacy jd analyzer`
- Line 202 references `src/test/jdAnalyzer.test.ts` — deleted in the same commit

**Major omissions (whole workspaces missing):**

The doc claims main navigation exposes "Build, Pipeline, Research, Prep, Letters, and Help" (line 26). Actual current routes under `src/routes/`: account, build, debrief, help, home, identity, legal, letters, linkedin, match, pipeline, prep, recruiter, research. **Identity, Match, LinkedIn, Recruiter, Debrief, Home, and Account are entirely absent from the inventory.**

**High-drift areas (10+ commits since doc edit):**

- Prep — `PrepPage.tsx` (28), `prepGenerator.ts` (28), `prepStore.ts` (15), `PrepPracticeMode.tsx` (6)
- Build — `BuildPage.tsx` (25), `AppShell.tsx` (26)
- Research — `ResearchPage.tsx` (20), `searchExecutor.ts` (9)
- Letters — `LettersPage.tsx` (16), `coverLetterStore.ts` (5), `coverLetterGenerator.ts` (5)
- Pipeline — `pipelineStore.ts` (10), `PipelinePage.tsx` (9)
- Persistence — `hydration.ts` (9), `contracts.ts` (8)

## What this task is for

For **doc 1 (PIPELINE_PREP_SPEC.md):** decide whether to update in place to reflect shipped reality, or archive entirely now that Pipeline/Prep are documented in `docs/development/domain-model.md` and the architecture docs (`facet-workspace-topology.md`, `identity-canonical-data.md`, doc-30 + doc-36 + doc-37). Most likely: archive, since the spec was a pre-implementation planning doc whose content is now stale and superseded.

For **doc 2 (vector-resume-v0.2-feature-reference.md):** rewrite to match current state. Two paths:

1. **Rewrite in place** — keep the file path and NAVIGATOR entry, restructure around the 14 current routes plus shared subsystems (persistence, theme, AI proxy). Drop the v0.2 versioning from the slug; rename to `docs/reference/feature-reference.md`.
2. **Archive and replace** — move the existing file to `docs/archive/` as a v0.2 snapshot artifact, write a fresh `docs/reference/feature-reference.md` from scratch.

Either way: the new doc must cover all 14 workspaces (or document the exclusion of `legal` and `help` if they are deliberately skipped).

NAVIGATOR.md needs its Reference table updated to point to the new file.

## Audit provenance (doc 2)

- Validator: `/Users/nick/.claude/skills/doc-claim-validator/`
- Claims extracted: 74; Outright fail: 2; Stale: 38 (10 high-drift, 28 medium/low)
- Per the delegation-verification rule, verify each surface claim before re-encoding it — the auditor flagged staleness, not truth, on the 38 stale items.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 For PIPELINE_PREP_SPEC.md: decide on rewrite-in-place vs archive (record the decision in the task notes); execute the chosen path
- [ ] #2 If PIPELINE_PREP_SPEC.md is archived, ensure no broken references remain in NAVIGATOR.md or other docs that link to it
- [ ] #3 If PIPELINE_PREP_SPEC.md is rewritten, it must reflect the shipped Pipeline/Prep routes and call out remaining gaps as TODOs explicitly
- [ ] #4 For vector-resume-v0.2-feature-reference.md: covers all 14 routes under src/routes/ (or explicitly notes which are excluded and why)
- [ ] #5 All file path references in the rewritten/replaced feature-reference doc resolve to existing files (verified by ls or grep before commit)
- [ ] #6 All store and generator references in the feature-reference doc match current source under src/store/ and src/utils/
- [ ] #7 Persistence section refers to src/persistence/README.md rather than duplicating it
- [ ] #8 AI proxy section either references docs/reference/ai-feature-audit.md for the inventory, or links to it explicitly to avoid duplication
- [ ] #9 Test coverage section lists current test files (verified to exist at the time of edit)
- [ ] #10 docs/NAVIGATOR.md Reference section is updated to point to the new feature-reference doc; old slug is removed or archived
- [ ] #11 Old vector-resume-v0.2-feature-reference.md is either rewritten in place or moved to docs/archive/ (per implementer judgment) with no orphaned NAVIGATOR entries
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Archive the stale pre-implementation Pipeline/Prep spec if current docs already supersede it, then remove or update live references.\n2. Replace the v0.2 feature inventory with a current docs/reference/feature-reference.md covering current route surfaces and shared subsystems.\n3. Verify referenced files, stores, generators, and test files against the repo; keep persistence/AI proxy sections as pointers to canonical docs.\n4. Run doc validation/format checks, independent docs review, update TASK-44 checklist, and commit via cortex.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Documentation has been created/modified/removed as needed.
- [ ] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [ ] #4 Test changes were approved by a test gap analysis review
- [ ] #5 Changes to integration points are covered by tests
- [ ] #6 All tests pass successfully
- [ ] #7 Automatic formatting was applied.
- [ ] #8 Linters report no WARNINGS or ERRORS
- [ ] #9 The project builds successfully
<!-- DOD:END -->
