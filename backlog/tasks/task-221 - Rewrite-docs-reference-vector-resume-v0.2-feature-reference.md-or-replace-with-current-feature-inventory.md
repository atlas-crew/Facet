---
id: TASK-221
title: >-
  Rewrite docs/reference/vector-resume-v0.2-feature-reference.md (or replace
  with current feature inventory)
status: To Do
assignee: []
created_date: '2026-05-06 03:58'
labels:
  - docs
  - stale
dependencies: []
references:
  - docs/reference/vector-resume-v0.2-feature-reference.md
  - docs/NAVIGATOR.md
  - docs/reference/ai-feature-audit.md
  - src/routes/
  - src/persistence/README.md
  - CLAUDE.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context

Surfaced by the 2026-05-05 doc-claim-validator pass. The current
`docs/reference/vector-resume-v0.2-feature-reference.md` was last edited
2026-03-13 and is significantly out of sync with the shipped product. It is
indexed in `docs/NAVIGATOR.md` under Reference as the "Current feature
inventory for the shipped Facet product surface" — that promise no longer
holds.

## Findings

**Outright failures (deleted files):**

- Line 61 references `src/utils/jdAnalyzer.ts` — deleted by commit
  `0165a75 refactor(build): retire legacy jd analyzer`
- Line 202 references `src/test/jdAnalyzer.test.ts` — deleted in the same commit

**Major omissions (whole workspaces missing):**

The doc claims main navigation exposes "Build, Pipeline, Research, Prep,
Letters, and Help" (line 26). Actual current routes (`src/routes/`):
account, build, debrief, help, home, identity, legal, letters, linkedin,
match, pipeline, prep, recruiter, research. **Identity, Match, LinkedIn,
Recruiter, Debrief, Home, and Account are entirely absent from the
inventory.**

**High-drift areas (10+ commits since doc edit, target file moved heavily):**

- Prep workspace surfaces — `PrepPage.tsx` (28), `prepGenerator.ts` (28),
  `prepStore.ts` (15), `PrepPracticeMode.tsx` (6)
- Build workspace — `BuildPage.tsx` (25), `AppShell.tsx` (26)
- Research — `ResearchPage.tsx` (20), `searchExecutor.ts` (9)
- Letters — `LettersPage.tsx` (16), `coverLetterStore.ts` (5),
  `coverLetterGenerator.ts` (5)
- Pipeline — `pipelineStore.ts` (10), `PipelinePage.tsx` (9)
- Persistence — `hydration.ts` (9), `contracts.ts` (8)
- Env — `VITE_ANTHROPIC_PROXY_URL` reference (25)
- Test files — multiple (5-18 each)

## What this task is for

Rewrite the reference doc to match current state. Two paths the implementer
should choose between:

1. **Rewrite in place** — keep the file path and NAVIGATOR entry,
   restructure around the 14 current routes plus shared subsystems
   (persistence, theme, AI proxy). Drop the v0.2 versioning from the
   slug (that anchor doesn't reflect reality anymore — the file should
   probably be `docs/reference/feature-reference.md`).
2. **Archive and replace** — move the existing file to `docs/archive/` as
   a v0.2-snapshot artifact, write a fresh `docs/reference/feature-reference.md`
   from scratch.

Either way: the new doc must cover all 14 workspaces (or document the
exclusion of `legal` and `help` if they are deliberately skipped).

NAVIGATOR.md needs its Reference table updated to point to the new file.

## Audit provenance

- Validator: `/Users/nick/.claude/skills/doc-claim-validator/`
- Claims extracted: 74; Outright fail: 2; Stale: 38 (10 high-drift, 28 medium/low)
- Per the delegation-verification rule, the implementer should verify each
  surface claim before re-encoding it — the auditor flagged staleness, not
  truth, on the 38 stale items.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The new feature-reference doc covers all 14 routes under `src/routes/` (or explicitly notes which are excluded and why)
- [ ] #2 All file path references resolve to existing files (verified by `ls` or grep before commit)
- [ ] #3 All store and generator references match current source under `src/store/` and `src/utils/`
- [ ] #4 Persistence section accurately describes the current coordinator + backend split (refer to `src/persistence/README.md` rather than duplicate it)
- [ ] #5 AI proxy section either references `docs/reference/ai-feature-audit.md` for the inventory, or links to it explicitly to avoid duplication
- [ ] #6 Test coverage section lists current test files (verified to exist at the time of edit)
- [ ] #7 `docs/NAVIGATOR.md` Reference section is updated to point to the new doc; old slug is removed or archived
- [ ] #8 Old file is either rewritten in place or moved to `docs/archive/` (per implementer judgment) with no orphaned NAVIGATOR entries
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
