---
id: TASK-140
title: Evaluate opus model for prep generation quality
status: Done
assignee:
  - '@codex'
created_date: '2026-04-16 13:12'
updated_date: '2026-05-09 01:09'
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
- [x] #1 Side-by-side comparison completed for 2-3 real pipeline entries
- [x] #2 Quality differences documented across story blocks, donts, questions, key points
- [x] #3 Decision recorded: switch to opus or stay with sonnet
- [ ] #4 If switching: model parameter updated, timeout adjusted, cost documented
- [x] #5 If staying: rationale documented for future reference
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Ran minimal live canonical-JDAnalysis Opus vs Sonnet comparison through the local proxy. Evidence: proxy capabilities returned Opus/Sonnet/Haiku available; npx vitest run test-results/task140-harness/task140.eval.test.ts --reporter verbose passed in 527.67s with 4/4 model calls HTTP 200. Report: /tmp/facet-task-140-opus-eval-2026-05-09T00-40-11-498Z/TASK-140-eval-report.md. Caveat: two entries were evaluated: one saved persona/JDAnalysis fixture (Maya/Pillar) and one sample pipeline entry with eval-local canonical JDAnalysis.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Decision: stay on Sonnet for prep generation for now. Opus did not produce meaningfully better coaching output on the evaluated canonical-JDAnalysis samples and was weaker on contract adherence. Pillar/Maya: Sonnet had 4 story cards, 6 conditionals, 16 numeric keypoint hits, 2 contract violations; Opus had 2 story cards, 4 conditionals, 0 numeric keypoint hits, 4 contract violations. Acme fixture: Sonnet had 12 cards, 3 story cards, 54 keypoints, 37 numeric script hits, 2 contract violations; Opus had 9 cards, 2 story cards, 39 keypoints, 11 numeric script hits, 3 contract violations. Opus had some sharper question/don't phrasing but not enough to justify 5x cost or weaker structured output. No tracked production code change required.
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
