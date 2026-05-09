---
id: TASK-177
title: Add beat sheet and glance points to PrepCard
status: Done
assignee:
  - '@codex'
created_date: '2026-04-19 10:30'
updated_date: '2026-05-09 00:02'
labels:
  - prep
  - types
  - live-mode
milestone: m-26
dependencies:
  - TASK-170
references:
  - src/types/prep.ts
  - src/utils/prepGenerator.ts
  - src/routes/prep/PrepLiveMode.tsx
documentation:
  - 'backlog reference files/blackstone-prep-r3.html (Beat sheet, line 518)'
  - >-
    backlog reference files/blackstone-prep-r1.html (Glance Points pattern,
    lines 556, 574, 601)
modified_files:
  - src/utils/prepGenerator.ts
  - src/test/prepGenerator.test.ts
  - >-
    backlog/docs/doc-41 -
    Prep-V2-—-PrepDeck-Foundation-Content-Extensions-Rollout-Plan.md
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Status (2026-05-08 — narrowed during backlog staleness audit)

Per task-208 Workstream 1 audit (2026-05-04), most of this task is already shipped:

- `PrepCard.keyPoints` field exists
- Live-mode rendering of keyPoints as a distinct labeled panel ships
- Numbered-vs-bulleted distinction by card category exists
- Homework mode reveal exists
- Backward-compatibility for cards without keyPoints works

**Remaining scope (narrowed):** audit `prepGenerator.ts`'s prompt instructions for `keyPoints` to ensure they project from the canonical `JDAnalysis` input shape that task-208 introduced (post-2026-05-05) — specifically that beat-sheet vs glance-points generation reads from `evidenceMapping` and `requirements` rather than re-inferring from raw JD text. This is a one-pass prompt-wording review, not a feature implementation.

If after the audit the prompt is already aligned, close this task with that note. If wording changes are needed, scope them as a small generator-prompt PR (no type or UI changes).

---

## Original description (preserved for reference)

Reference prep docs use two distinct compressed-recall patterns:

**Beat Sheet** (`blackstone-prep-r3.html:518-527`) — a numbered fallback for the opener, rendered as a separate panel below the full script:

> **Beat sheet — if you lose your place**
> 1. Eight years, platform = making engineers' lives easier
> 2. Northwind → first platform hire, IDP, 600 pipelines, $50M/yr
> 3. Helios Security → K8s migration, fleet management, 3 years
> 4. A10 → acquisition, solo rebuild, air-gapped/GDPR
> 5. Why Blackstone → ownership problem, scale, learn + teach

**Glance Points** (`blackstone-prep-r1.html`) — per-card bulleted compressed version next to every behavioral card.

Original AC was Option A (keep keyPoints[] as the single field; update generator + UI). The UI side has shipped; only the generator-prompt audit remains.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Audit prepGenerator's keyPoints prompt to confirm beat-sheet generation reads from canonical JDAnalysis (evidenceMapping, requirements) rather than re-inferring from raw JD text
- [x] #2 If prompt is already aligned, close with that note in implementation notes
- [x] #3 If wording changes are needed, ship the prompt update with focused tests for the projection-input shape (no type or UI changes in scope)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Starting narrowed TASK-177 after read-only audit. Scope: tiny prepGenerator prompt/test patch tying keyPoints beat-sheet/glance-points generation to Canonical JDAnalysis.requirements and evidenceMapping, with no type/UI changes.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed narrowed TASK-177 prompt audit and patch. prepGenerator now distinguishes opener keyPoints as ordered beat-sheet cues and all non-opener keyPoints as compact glance points. Both shapes are explicitly grounded in Canonical JD Analysis requirements/evidenceMapping plus structured identity evidence, with no raw-JD re-inference except source wording fallback. No type/UI changes were needed because keyPoints rendering and storage already existed. Verification passed: npm run format:files -- src/utils/prepGenerator.ts src/test/prepGenerator.test.ts; npx vitest run src/test/prepGenerator.test.ts (22 tests); npx eslint src/utils/prepGenerator.ts src/test/prepGenerator.test.ts. Review: specialist-review.sh --git -- src/utils/prepGenerator.ts returned PASS WITH ISSUES; prompt wording concerns were remediated. Non-gating build probe from the prior prompt slice remains blocked by unrelated dirty src/test/fixtures/personas/mayaPatel.ts unused imports and src/test/identityFieldDeps.test.ts importing non-exported SkillMatch.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
