---
id: TASK-138
title: Populate Numbers to Know from identity model metrics
status: To Do
assignee: []
created_date: '2026-04-16 13:12'
labels:
  - prep
  - identity
  - generation
  - content
milestone: m-18
dependencies: []
references:
  - docs/development/plans/live-cheatsheet-content-v2.md#B6
  - src/identity/schema.ts
  - src/utils/prepIdentityContext.ts
  - src/utils/prepGenerator.ts
  - src/utils/prepCheatsheet.ts
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pull structured metrics from identity model bullets into the prep generation pipeline to produce a "Numbers to Know" section with real, human-reviewed data.

**Identity data source:**
`ProfessionalRoleBullet.metrics` is a `Record<string, string | number | boolean>`. The MVP already wires identity into prep (TASK-128). This task extends that to:
1. Collect all `metrics` entries from bullets on roles relevant to the target vector
2. Pass them explicitly to the generation prompt as "candidate metrics"
3. AI selects the 4-6 most impactful and formats them for stat box display

**Generation changes:**
- Add a "Numbers to Know" section request to the prompt
- Two groups in the response: `numbersToKnow.candidate` (from identity metrics) and `numbersToKnow.company` (AI-extracted from JD/research)
- Add `numbersToKnow` to PrepDeck type

**Derivation changes:**
- Add a "Numbers to Know" section to `derivePrepCheatsheetSections` sourced from `deck.numbersToKnow`
- Two sub-groups within the section: "Your Work" and "Their Company"

**Rendering:**
- Stat box rendering already exists from the MVP (TASK-131)
- This task wires the data through to produce the actual stat boxes with real numbers

**Key principle:** The AI curates and formats — it does NOT invent metrics. If the identity model has `{ "pipeline_count": 600 }`, the AI formats it as "600+" with label "CI/CD Pipelines". It does not hallucinate "$2M savings" from nowhere.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Identity bullet metrics collected and filtered to vector-relevant roles
- [ ] #2 Candidate metrics passed to generation prompt explicitly
- [ ] #3 Generation response includes numbersToKnow with candidate and company groups
- [ ] #4 numbersToKnow stored on PrepDeck
- [ ] #5 Numbers to Know section derived in cheatsheet with two sub-groups
- [ ] #6 Stat boxes render real identity metrics, not AI-invented numbers
- [ ] #7 Works gracefully when identity has no metrics (section omitted)
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
