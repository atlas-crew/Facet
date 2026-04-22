---
id: TASK-185
title: Add explicit-assumptions transparency to search output
status: To Do
assignee: []
created_date: '2026-04-19 10:00'
labels:
  - search-redesign
  - transparency
  - output-contract
milestone: m-20
dependencies:
  - TASK-160
references:
  - src/types/search.ts
  - src/utils/searchExecutor.ts
documentation:
  - 'backlog reference files/Platform and Security Platform Job Search Report.pdf (Search approach and assumptions section)'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Platform/Security Job Search Report includes an explicit "Assumptions" section in its search-approach narrative:

> Assumptions (because they were not fully specified in the parameters file):
> - You are eligible to work in the United States without sponsorship (several top roles explicitly state no visa sponsorship).
> - Your "hybrid acceptable" constraint applies only within the Greater Tampa Bay area; otherwise you are targeting remote-first roles (I treated this as equivalent to "remote US required" for ranking).
> - You are located in Florida (used only to sanity-check "US remote / state eligibility" language where postings restrict locations).

This is a credibility-earning transparency mechanism: any time the search has to fill gaps in the input, it surfaces what it filled. The user can correct the assumptions before committing to Phase 2 — or flag them if Phase 2 used them incorrectly.

Currently no schema or prompt contract supports this.

**Type addition (extend TASK-160's SearchRunNarrative):**

```typescript
interface SearchAssumption {
  id: string
  claim: string              // "You are eligible to work in the US without sponsorship"
  source: 'inferred' | 'assumed-default' | 'explicit-fallback'
  rationale?: string         // Why this was assumed (e.g., "visa status not specified")
  confidence: 'high' | 'medium' | 'low'
  overridable: boolean       // Can user correct this in-flow?
}

interface SearchRunNarrative {
  // existing...
  assumptions?: SearchAssumption[]
}
```

Also applies to `SearchThesis` (Phase 1):

```typescript
interface SearchThesis {
  // existing...
  assumptions?: SearchAssumption[]
}
```

**Prompt contract (Phase 1 and Phase 2):**

> If any material input is unspecified or ambiguous (visa status, location precision, compensation flexibility, travel willingness, etc.) you MUST record the assumption you made in the `assumptions[]` field. Do not silently assume. Every filled gap must be listed with a claim, rationale, and confidence level.

**UI surface:**

Render `assumptions[]` as a collapsible section at the top of the thesis editor (Phase 1) and search result view (Phase 2):

> **Assumptions (3)** — we made these calls because the input was ambiguous:
> • You are eligible to work in the US without sponsorship — low confidence. *Correct?*
> • You are open to remote-US roles outside Tampa Bay — high confidence. *Correct?*
> • Compensation floor is the target, not a hard floor — medium confidence. *Correct?*

Clicking "Correct?" opens the relevant identity field with the current value pre-filled, letting the user adjust. Corrections bump `identity.version` (TASK-159) and surface via downstream impact (TASK-168).

**Telemetry:**

Log assumption counts per run — a high assumption count is a signal that onboarding (TASK-157, free context sources) is underspecified.

**Why this matters:**
- Transparency: users see what the AI filled in, not just the output
- Correction path: wrong assumptions are a direct correction trigger — great extraction moment
- Credibility: "we had to guess on X" is more trustworthy than hidden assumptions
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 SearchAssumption type defined with id, claim, source, rationale?, confidence, overridable
- [ ] #2 SearchRunNarrative and SearchThesis have optional assumptions?: SearchAssumption[] fields
- [ ] #3 Phase 1 prompt instructs the model to record every gap-filled assumption with claim + rationale + confidence
- [ ] #4 Phase 2 prompt carries forward thesis assumptions and adds any new ones made during deep research
- [ ] #5 normalizeResults() parses and validates assumptions; drops malformed entries
- [ ] #6 Thesis editor renders assumptions as a collapsible section with per-assumption "Correct?" actions
- [ ] #7 Correction actions open the relevant identity field with current value for user adjustment
- [ ] #8 Corrections bump identity.version and trigger downstream impact display (TASK-168)
- [ ] #9 Telemetry: assumption count per run is logged for shepherding analysis
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
