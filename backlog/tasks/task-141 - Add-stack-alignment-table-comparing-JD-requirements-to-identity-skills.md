---
id: TASK-141
title: Add stack alignment table comparing JD requirements to identity skills
status: To Do
assignee: []
created_date: '2026-04-16 13:13'
labels:
  - prep
  - identity
  - generation
  - content
milestone: m-18
dependencies:
  - TASK-138
references:
  - docs/development/plans/live-cheatsheet-content-v2.md#B7
  - src/identity/schema.ts
  - src/utils/prepGenerator.ts
  - src/utils/prepCheatsheet.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Generate a "Their Stack | Your Match | Confidence" comparison table by analyzing JD tech requirements against the identity model's skill enrichment data.

**Data source:**
- JD tech requirements: extracted by AI from the job description
- Candidate skills: from `ProfessionalIdentityV3.skill_groups[].skills[]` with `depth` (expert/strong/working/basic) and `positioning`

**Generation changes:**
- Add `stackAlignment` to generation response: `Array<{ theirTech: string; yourMatch: string; confidence: string }>`
- AI compares JD requirements against identity skills, produces honest alignment
- Confidence levels: "Strong", "Solid", "Working knowledge", "Adjacent experience", "Gap"
- Store on PrepDeck as `stackAlignment`

**Derivation:**
- Add stack alignment as a sub-section within Numbers to Know, or as a standalone section in Tactical group
- Render as a standard HTML table

**Rendering:**
- Three-column table with header row
- Confidence column color-coded: green (Strong/Solid), amber (Working/Adjacent), red (Gap)

**This is the foundation for gap framing (TASK next) — if the alignment table shows "Gap" entries, those become candidates for gap-framing cards.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 stackAlignment type added to PrepDeck
- [ ] #2 Generation produces stack alignment from JD vs identity skills
- [ ] #3 Confidence levels are honest (includes gaps, not just strengths)
- [ ] #4 Table renders in live cheatsheet with color-coded confidence
- [ ] #5 Works gracefully when identity has no skills (table omitted)
- [ ] #6 Alignment data available for downstream gap framing
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
