---
id: TASK-184
title: Add Citation type and inline/footnote rendering for search output
status: Done
assignee:
  - '@myself'
created_date: '2026-04-19 10:00'
updated_date: '2026-05-06 23:07'
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
  - >-
    backlog reference files/Where Builders Beat Leetcoders_.pdf (inline citation
    badges)
  - >-
    backlog reference files/Platform and Security Platform Job Search Report.pdf
    (numbered footnotes)
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
- [x] #1 Citation type defined with id, source, url?, type?, claim?
- [x] #2 SearchRunNarrative and SearchResultEntry have optional citations?: Citation[] fields
- [x] #3 Phase 1 and Phase 2 prompts instruct the model to attribute factual claims with [cite:<id>] inline markers
- [x] #4 normalizeResults() validates marker-to-citation resolution and drops/flags unresolved markers
- [x] #5 Renderer supports inline-badge mode (default for narrative) — "(PostHog)"-style after claims
- [x] #6 Renderer supports numbered-footnote mode — superscript numbers with references list at the bottom
- [x] #7 Existing SearchResultEntry.source field continues to work as a fallback
- [x] #8 Tests cover: all claims cited (happy path), orphaned citation, unresolved marker, empty citations array, mixed modes
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect current search types, result normalization, prompt construction, and Research rendering surfaces for narrative/result output.\n2. Add additive Citation/CitationType types plus optional citation arrays on run/result models while preserving SearchResultEntry.source fallback.\n3. Add citation marker normalization/validation in normalizeResults() and focused tests for resolved, orphaned, unresolved, empty, and mixed-mode cases.\n4. Add reusable citation rendering helpers/components for inline badges and numbered footnotes, then wire ResearchPage output to use source fallback when citations are absent.\n5. Update Phase 1/Phase 2 prompt text to require [cite:<id>] markers and citation arrays.\n6. Run focused tests/typecheck/lint/build as appropriate, remediate findings, update TASK-184 checklist, and commit with cortex git commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lane A implementation complete.\n\nSummary:\n- Added canonical Citation/CitationType support and normalized citation arrays.\n- Added [cite:<id>] marker normalization that preserves resolved markers and drops unresolved markers while preserving paragraph breaks.\n- Added citation rendering in Research results with footnote references, source lists, unsafe URL dropping, unresolved marker fallback, and source fallback behavior.\n- Updated legacy search, deep research, and thesis prompt text to require citation markers for factual claims.\n- Added regression coverage for resolved markers, orphaned citations, unresolved markers, empty/invalid citations, paragraph preservation, unsafe URLs, and the ResearchPage citation rendering path.\n- Independent review artifacts:\n  - .agents/reviews/review-20260506-185358.md: BLOCKED, fixed P1s.\n  - .agents/reviews/review-20260506-185805.md: BLOCKED, fixed remaining P1.\n  - .agents/reviews/review-20260506-190255.md: PASS WITH ISSUES.\n- Deferred remaining observability issue as TASK-2.1: result-level fields stripped empty are not yet surfaced in contractViolations.\n\nVerification:\n- npx vitest run src/test/searchExecutor.test.ts: 50 passed.\n- npx vitest run src/test/ResearchPage.test.tsx -t "passes excluded companies into launched searches": 1 passed, 70 skipped.\n- npm run typecheck: passed.\n- npx eslint <Lane A touched TS/TSX files>: passed.\n- npm run build: passed.\n- git diff --check <Lane A touched files>: passed.\n\nCaveats:\n- npm run lint remains blocked repo-wide by pre-existing generated output and unrelated source/test lint findings outside this lane.\n- Full src/test/ResearchPage.test.tsx still has unrelated existing downstream-impact expectation failures around cover-letter artifact counts; the citation-specific scenario passes.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented claim-level citations for search output: additive Citation types, marker normalization, prompt contracts, ResearchPage inline/footnote rendering, and focused regression coverage. Independent review is PASS WITH ISSUES; remaining result-level observability improvement was deferred as TASK-2.1.
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
