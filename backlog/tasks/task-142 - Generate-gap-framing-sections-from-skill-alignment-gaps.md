---
id: TASK-142
title: Generate gap framing sections from skill alignment gaps
status: To Do
assignee: []
created_date: '2026-04-16 13:13'
labels:
  - prep
  - generation
  - content
milestone: m-18
dependencies:
  - TASK-141
references:
  - docs/development/plans/live-cheatsheet-content-v2.md#B3
  - src/utils/prepGenerator.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When the stack alignment table (TASK-141) identifies gaps, generate dedicated "What You Know, What You Don't" cards with honest acknowledgment + bridge to adjacent experience.

**Pattern from Unanet reference:**
1. Acknowledge the gap honestly ("I haven't shipped to GovCloud specifically")
2. Frame it as bounded ("a few weeks of focused ramp-up, not a fundamental gap")
3. Bridge to adjacent experience that transfers ("Those patterns transfer directly")

**Generation changes:**
- When stack alignment has entries with confidence "Gap" or "Adjacent experience", generate 1-2 gap-framing cards
- Each card has:
  - `notes` — the honest acknowledgment
  - `script` — the bridge/pivot language
  - `warning` — what NOT to say about the gap
  - `keyPoints` — transferable experience bullets
- Cards placed in Technical group with category 'technical'

**No new types needed.** Gap-framing cards are normal PrepCards with the right content structure. The generation prompt does the work.

**Rendering:** Standard three-layer disclosure. The warning block naturally highlights the pitfall, the script block provides the bridge language.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Gap entries from stack alignment trigger gap-framing card generation
- [ ] #2 Gap cards have honest acknowledgment in notes, bridge in script, pitfall in warning
- [ ] #3 Gap cards include keyPoints with transferable experience
- [ ] #4 Cards placed in Technical group
- [ ] #5 No gap cards generated when alignment has no gaps
- [ ] #6 Generated bridge language is specific to the candidate's actual experience
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
