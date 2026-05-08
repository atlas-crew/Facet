---
id: TASK-183
title: Add resume variant + bullet edits + keywords to search results
status: Done
assignee:
  - '@myself'
created_date: '2026-04-19 10:00'
updated_date: '2026-05-08 08:11'
labels:
  - search-redesign
  - output-enrichment
  - types
milestone: m-20
dependencies:
  - TASK-184
references:
  - src/types/search.ts
  - src/utils/searchExecutor.ts
  - src/routes/research/researchUtils.ts
documentation:
  - >-
    backlog reference files/Platform and Security Platform Job Search Report.pdf
    (deep-dive section)
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Platform/Security Job Search Report reference produces the most directive per-result output: each top-5 match includes a resume variant recommendation, 3 specific resume bullet edits tailored to the posting's language, and a keyword list reflecting posting-specific phrases.

This is a major gap in the current `SearchResultEntry` schema. The directive output pattern is what makes search results actionable vs. informational.

**SearchRequest input extension:**

The user can pass 0-N resume variants they maintain (e.g., "Platform", "Security Platform"). When multiple variants exist, deep research assigns each top result to one variant.

```typescript
interface SearchRequest {
  // existing...
  resumeVariants?: Array<{
    id: string
    label: string           // "Platform", "Security Platform"
    description?: string    // Optional summary of this variant's emphasis
  }>
}
```

**SearchResultEntry output extensions:**

```typescript
interface SearchResultBulletEdit {
  emphasis: 'lead' | 'supporting'
  text: string              // Full bullet text to paste at top of resume
  rationale?: string        // Why this bullet, tied to posting language
}

interface SearchResultEntry {
  // existing core fields...

  /** Which resume variant the AI recommends for this role (matches SearchRequest.resumeVariants[].id). */
  recommendedVariant?: string

  /** Specific bullet rewrites tailored to this posting's language — paste-ready text. */
  bulletEdits?: SearchResultBulletEdit[]

  /** Keywords to include in the resume for this role, mirroring the posting's language. */
  keywordsToInclude?: string[]
}
```

**Prompt contract (Phase 2, coordinated with TASK-151.2):**

When `SearchRequest.resumeVariants.length > 0`, the deep research prompt must instruct the model:
- For each top-5+ result, assign a `recommendedVariant` by id
- Produce 3 `bulletEdits` with `emphasis: 'lead'` for the #1 bullet, `emphasis: 'supporting'` for #2 and #3
- Each `bulletEdits[].text` is a complete resume bullet, written in first-person past-tense, with metrics, under 30 words
- `keywordsToInclude` is 8-12 specific phrases from the posting (not generic skills)

**Pipeline mapping:**

Update `createPipelineEntryDraft()` in `researchUtils.ts` to:
- Pre-populate `PipelineEntry.resumeVariant` from `recommendedVariant`
- Append `bulletEdits` to `PipelineEntry.notes` (formatted as a checklist) until the Build workspace can render them natively
- Store `keywordsToInclude` for later use in JD analysis

**UI:**

In the result card (`ResearchPage.tsx`), render the directive section as an expandable panel:
- "Recommended variant: Platform" (badge)
- "Top-of-resume edits" → 3 bullets with copy-to-clipboard buttons
- "Keywords to include" → comma-separated chips

Making the output paste-ready is the whole point.

**Backward compatibility:**

All new fields are optional. Existing search results without these fields render without the directive panel. Existing pipeline entries continue to work.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 SearchRequest has optional resumeVariants array with id/label/description
- [x] #2 SearchResultEntry has recommendedVariant?, bulletEdits?, keywordsToInclude? (all optional)
- [x] #3 SearchResultBulletEdit type defined with emphasis, text, rationale?
- [x] #4 Deep research prompt (TASK-151.2) produces these fields when resumeVariants is set
- [x] #5 Prompt contract enforces: 3 bullets, 1 lead + 2 supporting, full bullet text, first-person past-tense with metrics
- [x] #6 normalizeResults() in searchExecutor.ts parses and validates the new fields, dropping malformed entries rather than crashing
- [x] #7 createPipelineEntryDraft() pre-populates resumeVariant from recommendedVariant and appends bulletEdits to notes
- [x] #8 Result card UI renders recommended variant badge + bulletEdits with copy-to-clipboard + keywordsToInclude as chips
- [x] #9 Backward compatible: results without these fields render cleanly (no empty panels)
- [x] #10 Tests cover: all fields present, none present, partial fields, malformed AI output rejection
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Closed after worker implementation commit 635fbf4. Focused verification from lane: searchExecutor/deepSearchClient 75 tests passed, directive normalization/UI focused tests passed, scoped ESLint passed. Parent rollout re-ran npm run typecheck after concurrent salary lane fix and it passed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented resume directive outputs for search results: request resume variants, result recommended variant/bullet edits/keywords, deep-search prompt and normalization support, pipeline draft mapping/notes, expandable result-card directive UI, and focused coverage for present/absent/partial/malformed directive output. Commit: 635fbf4 feat(search): add resume directive outputs. Verification: focused search tests and scoped eslint passed in lane; npm run typecheck passed after concurrent TASK-196.2 cleanup.
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
