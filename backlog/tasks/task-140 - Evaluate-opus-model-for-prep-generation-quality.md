---
id: TASK-140
title: Evaluate opus model for prep generation quality
status: To Do
assignee: []
created_date: '2026-04-16 13:12'
updated_date: '2026-05-08 23:19'
labels:
  - prep
  - generation
  - evaluation
milestone: m-18
dependencies:
  - TASK-134
  - TASK-208
references:
  - docs/development/plans/live-cheatsheet-content-v2.md#B10
  - src/utils/prepGenerator.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Status Update (2026-05-08 — backlog staleness audit)

**REDIRECTED per task-208 Workstream 1 audit (2026-05-04).**

Now that `prepGenerator.ts` consumes canonical JDAnalysis (task-208 closed 2026-05-05), the model evaluation must compare **canonical-JDAnalysis projection quality**, not raw-JD prompt quality. The original methodology (compare sonnet vs opus on raw JD prompt) no longer reflects the production input shape.

**Re-run the comparison against the post-task-208 baseline:** generate prep for 2-3 real pipeline entries with the canonical-JDAnalysis input contract, sonnet and opus, and compare downstream artifact quality.

The original task body below describes the evaluation protocol, which still applies once the input shape is corrected.

---

Evaluate whether switching from sonnet to opus for prep generation produces meaningfully better content. The MVP shipped with sonnet — this is the quality assessment.

**Evaluation approach (REDIRECTED — uses canonical JDAnalysis input):**
1. Generate prep for 2-3 real pipeline entries using the current sonnet prompt **with canonical JDAnalysis as the structured input**
2. Re-generate the same entries with opus (same prompt, same canonical JDAnalysis)
3. Compare across these dimensions:
   - Story block quality: Are problem/solution/result narratives more specific and rehearsal-ready?
   - Don'ts quality: Are they personalized to the candidate/company gap, or generic?
   - Questions quality: Do they show genuine curiosity about the company's specific challenges?
   - Key points: Are glance points concrete ("Built 600+ pipelines") vs vague ("Improved CI/CD")?
   - Conditional branching: If B1 is in, are "if they push" responses more nuanced?

**Decision criteria:**
- If opus is noticeably better on personalization and coaching specificity → switch
- If marginal → stay with sonnet (5x cost difference, user pays via proxy)
- Document the tradeoff either way

**Implementation if switching:**
- Change model parameter in `prepGenerator.ts` from 'sonnet' to 'opus'
- May need to increase timeout (opus is slower)
- Document cost implications in the generation UI or prep page

**This is an evaluation task, not a guaranteed change.** The output is a decision + documentation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Side-by-side comparison completed for 2-3 real pipeline entries
- [ ] #2 Quality differences documented across story blocks, donts, questions, key points
- [ ] #3 Decision recorded: switch to opus or stay with sonnet
- [ ] #4 If switching: model parameter updated, timeout adjusted, cost documented
- [ ] #5 If staying: rationale documented for future reference
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
