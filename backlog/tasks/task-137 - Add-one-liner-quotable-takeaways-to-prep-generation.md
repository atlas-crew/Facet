---
id: TASK-137
title: Add one-liner quotable takeaways to prep generation
status: In Progress
assignee:
  - '@codex'
created_date: '2026-04-16 13:11'
updated_date: '2026-05-08 23:51'
labels:
  - prep
  - generation
milestone: m-18
dependencies:
  - TASK-208
references:
  - docs/development/plans/live-cheatsheet-content-v2.md#B12
  - src/utils/prepGenerator.ts
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Status Update (2026-05-08 — backlog staleness audit)

**REDIRECTED per task-208 Workstream 1 audit (2026-05-04).**

One-liner takeaways still ship as Prep-original `scriptLabel` / closer copy. **What changes is where role/company specificity comes from:** the one-liner content must derive from `JDAnalysis.strengthsToLead` and `JDAnalysis.positioningRecommendations`, NOT from raw-JD re-inference.

After task-208 closed (2026-05-05), `prepGenerator.ts` accepts canonical JDAnalysis as structured input. The prompt update should anchor one-liner specificity to canonical interpretation rather than asking the model to re-derive role/company framing from raw JD text.

The original task body below describes the user-facing capability, which still ships.

---

Request 1-2 memorable one-sentence takeaways per major story/project card. These are standalone quotable moments the user can grab during the interview.

**Approach:** Uses the existing `scriptLabel` field — no new types needed. The generation prompt requests cards or script blocks with `scriptLabel: "The One-Liner"` or similar contextual labels.

**Generation prompt update (REDIRECTED):**
- For behavioral and project cards that have storyBlocks, request an additional one-liner as a separate script block or as a closer storyBlock
- Anchor the one-liner's specificity to `JDAnalysis.strengthsToLead` and `JDAnalysis.positioningRecommendations` for canonical role/company framing
- One-liners should be concrete and specific, not generic motivational quotes
- Example: "The job isn't building from scratch — it's making the existing platform something teams actually want to use."

**Rendering:**
- One-liners with `scriptLabel` already render with labeled green borders from the MVP
- No new rendering work needed — this is a prompt-only change

**This is the smallest task in Wave 1.** It's purely a generation prompt refinement.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Generation prompt requests one-liners for behavioral and project cards
- [ ] #2 Generated one-liners use scriptLabel for contextual labeling
- [ ] #3 One-liners are specific and concrete, not generic
- [ ] #4 No new types or rendering changes required
- [ ] #5 Existing cards without one-liners render unchanged
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Starting TASK-137. Scope: prompt-only prep generation refinement anchored to canonical JDAnalysis.strengthsToLead and positioningRecommendations; add focused prompt-contract tests; no schema/UI changes.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
