---
id: TASK-146
title: Add multi-role narrative arc for core pitch opener
status: To Do
assignee: []
created_date: '2026-04-16 13:15'
updated_date: '2026-05-08 23:20'
labels:
  - prep
  - generation
  - identity
  - content
milestone: m-18
dependencies:
  - TASK-208
references:
  - docs/development/plans/live-cheatsheet-content-v2.md#B11
  - src/identity/schema.ts
  - src/utils/prepGenerator.ts
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Status Update (2026-05-08 — backlog staleness audit)

**REDIRECTED per task-208 Workstream 1 audit (2026-05-04).**

The 3-act multi-role narrative arc structure survives. **What changes is the relevance ranking source:** role relevance must be seeded by `JDAnalysis.evidenceMapping` (`topProjects`, `topBullets` matched to requirements via `matchedRequirementIds`), NOT by Prep re-ranking roles from raw JD text.

After task-208 closed (2026-05-05), `prepGenerator.ts` accepts canonical JDAnalysis as structured input. The detect-when-3+-roles-are-relevant logic should consume canonical evidence-to-requirement mapping rather than asking the model to re-evaluate roles against raw JD.

The original task body below describes the narrative pattern, which still ships.

---

When the candidate has 3+ relevant roles in the identity model, generate the "Tell me about yourself" opener as a 3-act narrative arc rather than a single-role pitch.

**Pattern from Unanet reference:**
- Thesis: "Three roles, three takes on the same problem: how do you let engineers ship reliably at scale?"
- Act 1: Build from scratch (earliest relevant role)
- Act 2: Own it across the org (middle role)
- Act 3: Modernize at speed (most recent)
- Connection: explicitly tied back to the target role's JD

**Implementation (REDIRECTED — uses canonical evidence mapping):**
- Maps to a single opener card with `storyBlocks` where each block is an act
- storyBlock labels: `note` for the thesis, then 3x `solution` (or a new act-specific label) for each act, `closer` for the connection
- Detect 3+-relevant-roles by reading `JDAnalysis.evidenceMapping.topProjects` and `topBullets` distinct `sourceLabel` count, filtered by `matchedRequirementIds` strength — NOT by re-ranking identity roles against the raw JD
- When canonical evidence shows fewer than 3 distinct role contexts: fall back to standard single-role opener

**Identity data needed:**
- Roles whose strongest bullets/projects appear in the JDAnalysis evidence mapping
- Key accomplishment from each role (the bullet/project entry already ranked by `score` in evidenceMapping)
- The connecting thread across roles (read from `JDAnalysis.strengthsToLead`)

**This depends on TASK-145 (openers as standalone sections) being in place.**
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 3-act narrative generated when identity has 3+ vector-relevant roles
- [ ] #2 Each act maps to a storyBlock with role context
- [ ] #3 Thesis and connection to target role included
- [ ] #4 Falls back to single-role opener when <3 relevant roles
- [ ] #5 Generated narrative is specific to candidate's actual career progression
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
