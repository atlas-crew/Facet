---
id: TASK-184
title: Add Citation type and inline/footnote rendering for search output
status: To Do
assignee: []
created_date: '2026-04-19 10:00'
labels:
  - search-redesign
  - types
  - output-enrichment
milestone: m-20
dependencies:
  - TASK-152
  - TASK-160
references:
  - src/types/search.ts
  - src/utils/searchExecutor.ts
  - src/routes/research/ResearchPage.tsx
documentation:
  - 'backlog reference files/Where Builders Beat Leetcoders_.pdf (inline citation badges)'
  - 'backlog reference files/Platform and Security Platform Job Search Report.pdf (numbered footnotes)'
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Both reference search reports attach source citations to factual claims, but in two different styles:

**"Where Builders Beat Leetcoders"** — inline citation badges after each factual claim:
> "Their interview process is a **paid $1,000 SuperDay** where candidates build a real project independently, (PostHog) (PostHog) preceded by a 45-60 minute technical conversation with no live coding (PostHog) and no brain teasers."

**"Platform and Security Platform Job Search Report"** — numbered footnote citations with a resolved reference list at the end:
> "The 'Hiring Without Whiteboards' movement — now cataloging **900+ companies** on GitHub (Built In) — has become mainstream enough that..."
> 
> Then at the end: "1 https://job-boards.greenhouse.io/hightouch/jobs/5701750004"

Current `SearchResultEntry.source: string` is one source per result — undersized. The reference output attaches multiple citations per claim, inline with prose.

**Type additions:**

```typescript
type CitationType =
  | 'careers'            // Company careers page
  | 'public'             // Public blog, about page
  | 'review'             // Glassdoor, Blind
  | 'index'              // LinkedIn, Wellfound, Levels.fyi, Remote Rocketship
  | 'github'             // GitHub profile/repo
  | 'news'               // News article
  | 'other'

interface Citation {
  id: string                   // For footnote numbering
  source: string               // "PostHog", "Glassdoor", "Built In"
  url?: string
  type?: CitationType
  claim?: string               // What this citation supports (optional context)
}
```

**Inline markers in prose:**

Narrative strings (executiveSummary, candidateEdge, searchApproach, etc.) carry inline markers the renderer can resolve:

```
"Their interview process is a paid $1,000 SuperDay [cite:posthog-careers] preceded by..."
```

The renderer reads `[cite:<id>]` markers and looks up `citations[]` by id, rendering as inline badges or superscript footnote numbers based on display mode.

**Extensions to existing types:**

```typescript
interface SearchRunNarrative {
  // existing...
  citations?: Citation[]        // All citations referenced from prose fields
}

interface SearchResultEntry {
  // existing...
  citations?: Citation[]        // Citations used in this entry's prose (candidateEdge, etc.)
}
```

**Rendering modes:**

Two display modes, user-selectable or template-driven:
- **Inline badges** — `(PostHog)`-style tags after the claim (default for narrative results)
- **Numbered footnotes** — superscript numbers with a resolved references list at the bottom (default for table/report results)

**Prompt contract:**

Update Phase 2 (TASK-151.2) and Phase 1 (TASK-151.1) prompts:
> Every factual claim — interview process details, compensation numbers, company size, team structure, hiring status — must be attributed to a specific source. Inline markers use the format `[cite:<id>]` where `<id>` is a slug matching a Citation in the `citations` array. Do not make claims you cannot cite.

**Validation:**

In `normalizeResults()`:
- Check every `[cite:<id>]` marker in prose resolves to an entry in `citations[]`
- Drop unresolved markers (silent fallback) or flag contract violation
- Log citation coverage metrics — claims with no citations, orphaned citations

**Backward compatibility:**

The existing `SearchResultEntry.source: string` field stays. New `citations?: Citation[]` is additive. Renderers prefer `citations[]` when present, fall back to `source` when absent.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Citation type defined with id, source, url?, type?, claim?
- [ ] #2 SearchRunNarrative and SearchResultEntry have optional citations?: Citation[] fields
- [ ] #3 Phase 1 and Phase 2 prompts instruct the model to attribute factual claims with [cite:<id>] inline markers
- [ ] #4 normalizeResults() validates marker-to-citation resolution and drops/flags unresolved markers
- [ ] #5 Renderer supports inline-badge mode (default for narrative) — "(PostHog)"-style after claims
- [ ] #6 Renderer supports numbered-footnote mode — superscript numbers with references list at the bottom
- [ ] #7 Existing SearchResultEntry.source field continues to work as a fallback
- [ ] #8 Tests cover: all claims cited (happy path), orphaned citation, unresolved marker, empty citations array, mixed modes
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
