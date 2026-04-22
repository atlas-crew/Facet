---
id: TASK-171
title: Add structured PrepCompanyIntel and PrepInterviewer to PrepDeck
status: To Do
assignee: []
created_date: '2026-04-19 10:30'
labels:
  - prep
  - types
  - structured-intel
milestone: m-26
dependencies:
  - TASK-154
references:
  - src/types/prep.ts
  - src/utils/prepGenerator.ts
  - src/routes/prep/PrepLiveMode.tsx
documentation:
  - 'backlog doc-25: Gap 3 Named Interviewer Intel'
  - 'backlog reference files/unanet-hm-prep.html (Unanet Intel grid, Named Team Members)'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`unanet-hm-prep.html` (lines 216-271) renders company intel and named team members as structured 6-cell grids, not free text:

**Unanet Intel grid:**
- What they do: "ERP and CRM SaaS for AEC and GovCon..."
- Scale: "4,300+ customers · 425+ employees. Inc. 5000 fast-growing."
- The role: "Newly created. CRM engineering org..."
- Stack: "AWS commercial + GovCloud, EKS, GitLab CI/CD..."
- Team: "~35 engineers across Dev/QA/Delivery..."
- AI posture: "'AI-first.' Already using Claude in their SDLC."

**Named team members grid:**
- Prashant Luthra — SVP Product Development. Likely 2 levels up. Probably not the HM.
- Sastry Anipindi — Sr. Director. Most likely the hiring manager.
- Assad Jarrahian — CEO. Won't be in this round.

Current `PrepDeck.companyResearch: string` is free text — can't render the grid. Doc-25 Gap 3 deferred to prompt-only extraction of named people; this task moves to structured representation since TASK-156 (round progression) depends on structured interviewer data (who you talked to in R1 matters for R2).

**Type additions:**

```typescript
interface PrepCompanyIntel {
  whatTheyDo?: string
  scale?: string                       // Size description
  theRole?: string                     // Role context in the org
  stack?: string                       // Tech stack summary
  team?: string                        // Team structure + size
  aiPosture?: {
    strength: 'strong' | 'moderate' | 'weak' | 'unknown'
    narrative: string
    signals?: string[]                 // "Already using Claude", "Hiring AI PMs"
  }
  other?: Record<string, string>       // Extensibility for additional labeled cells
}

interface PrepInterviewer {
  id: string
  name: string
  title: string
  likelyRole?: 'hiring-manager' | 'above-hm' | 'peer' | 'skip-level' | 'cross-functional' | 'recruiter' | 'unknown'
  coachingNote?: string                // "Most likely the HM. Be conversational."
  // Round history (populated over time by TASK-156)
  metInRounds?: number[]
  notes?: string                       // Free-text observations
}

interface PrepDeck {
  // existing fields...
  companyIntel?: PrepCompanyIntel      // Structured grid; coexists with companyResearch free text
  interviewers?: PrepInterviewer[]
}
```

**Generation:**

Update `prepGenerator.ts` to:
- Populate `companyIntel` from `companyResearch` + identity + JD (AI extracts the 6 fields when possible)
- Parse named-people patterns from `companyResearch` into `interviewers[]`; infer `likelyRole` from title + context
- Include a meta-entry like "If unsure who you're talking to" — generated as an additional interviewers entry with `name: ''`, `likelyRole: 'unknown'`, and a coachingNote (reference pattern from unanet-hm-prep)

**UI:**

In `PrepLiveMode.tsx`, render `companyIntel` as a 2-column intel grid at the top (above openers). Render `interviewers[]` as a separate intel grid below company intel. Both are collapsible but default-open.

Keep `companyResearch` free-text field — `companyIntel` is derived from it at generation, but user can edit either. On regeneration, AI re-derives companyIntel; user edits to interviewers persist.

**Integration with TASK-156:**

`interviewers[].metInRounds` is populated when users record in the debrief form who they spoke with in a given round. Round 2 prep can reference who was in Round 1 by name.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 PrepCompanyIntel type defined with 6+ optional cell fields + other extensibility map
- [ ] #2 PrepInterviewer type defined with name, title, likelyRole, coachingNote, metInRounds?, notes?
- [ ] #3 PrepDeck has optional companyIntel? and interviewers? fields
- [ ] #4 prepGenerator populates companyIntel from companyResearch + identity + JD
- [ ] #5 Named-people patterns extracted from companyResearch into interviewers[]; likelyRole inferred from title
- [ ] #6 "If unsure who you're talking to" meta-entry generated when interviewer identity is uncertain
- [ ] #7 PrepLiveMode renders companyIntel as intel grid above openers
- [ ] #8 PrepLiveMode renders interviewers[] as separate intel grid
- [ ] #9 companyResearch free-text field continues to work; companyIntel is derivative
- [ ] #10 interviewers[].metInRounds integrates with TASK-156 debrief capture
- [ ] #11 Backward compatible: decks without these fields render cleanly
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
