---
id: TASK-154
title: Add meta-strategy and delivery coaching to prep generation prompt
status: Done
assignee: []
created_date: '2026-04-19 06:01'
updated_date: '2026-04-19 06:09'
labels:
  - prep
  - prompt-engineering
  - quick-win
milestone: m-22
dependencies: []
references:
  - src/utils/prepGenerator.ts
documentation:
  - 'backlog doc-25: Prep Workspace Gap Analysis, Gaps 1-4'
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Enrich the `prepGenerator.ts` system prompt to produce the strategy/meta-coaching layer that's missing from current prep output. This is pure prompt engineering — no schema changes, no new UI components, no store changes. The existing `notes`, `warning`, `scriptLabel`, and `categoryGuidance` fields already hold this content.

Add these to the AI generation instructions:

1. **"Why this works" meta-strategy** — For opener and gap-framing cards, generate a `notes` block explaining the positioning logic: "This opener emphasizes release engineering because their JD prioritizes CI/CD. Most candidates lead with 'platform engineer' — leading with 'release engineer' is more specific and rarer."

2. **Delivery coaching** — In `warning` fields, add time limits and tone guidance: "Keep it under 90 seconds. This is a trailer, not the movie. End on the hook and let them ask." "Don't fake this. If they ask follow-ups, you'll get caught."

3. **Strategic framing** — In `categoryGuidance`, add interview-dynamic coaching based on who reached out first: "They reached out to you. This is 'do I want to work with this person' not 'convince me you belong here.' Be conversational."

4. **Named people extraction** — When `companyResearch` mentions names/titles, generate a dedicated `intel`-tagged card with structured people data and role inference: "Sastry Anipindi — Sr. Director. Most likely the hiring manager."

5. **Competitive positioning** — For skills where the candidate has market-rare combinations, generate a `notes` or `deepDive` block: "GitLab admin experience is uncommon. Most candidates have GitHub Actions or Jenkins. Lean into it."

Reference: backlog doc-25, Gaps 1-4. Compare against Unanet HM prep and Blackstone R3 prep reference documents.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Opener cards include a notes block explaining WHY the opener is framed the way it is
- [ ] #2 Gap-framing cards include 'Don't fake this' style warnings with honest framing strategy
- [ ] #3 Cards include delivery coaching in warning field (time limits, tone, when to stop talking)
- [ ] #4 categoryGuidance includes interview-dynamic framing when application method is known (inbound vs cold)
- [ ] #5 When companyResearch contains named people, an intel-tagged card is generated with role inference
- [ ] #6 At least 2-3 skills per deck get competitive positioning notes identifying market-rare combinations
- [ ] #7 Existing card structure and fields are used — no schema changes
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added META-STRATEGY AND DELIVERY COACHING section to the prepGenerator.ts system prompt. Five enrichment directives added to the AI generation instructions, all using existing card fields (notes, warning, categoryGuidance, tags, deepDives) — no schema changes.

1. **Why This Works** — AI now generates positioning logic explanations in `notes` for opener and gap-framing cards
2. **Delivery Coaching** — Time limits, tone guidance, and \"stop talking\" cues in `warning` fields  
3. **Strategic Framing** — Interview-dynamic coaching in `categoryGuidance` (inbound vs cold apply detection)
4. **Named People Intel** — When companyResearch mentions people, generates `intel`-tagged situational card with role inference
5. **Competitive Positioning** — Identifies 2-3 market-rare skill combinations and explains why they're differentiators

Single file change: `src/utils/prepGenerator.ts` lines 416-433 (system prompt enrichment). All existing tests pass. No schema, store, or UI changes required."
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
