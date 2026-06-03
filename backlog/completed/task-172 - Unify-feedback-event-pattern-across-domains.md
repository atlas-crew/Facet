---
id: TASK-172
title: 'Unify feedback event pattern across search, prep, and letter domains'
status: Done
assignee:
  - '@codex'
created_date: '2026-04-19 10:30'
updated_date: '2026-05-08 09:49'
labels:
  - shepherding
  - feedback
  - cross-cutting
  - types
milestone: m-20
dependencies:
  - TASK-163
references:
  - src/types/search.ts
  - src/types/prep.ts
documentation:
  - 'backlog doc-26: Cross-cutting Fresh-Context Critique Triggers'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-163 defines `SearchFeedbackEvent` for the search result feedback loop. Prep, cover letters, and future domains will want the same shape — feedback events that can flow back to the identity model, be aggregated, and track writeback state. Without a unified pattern, each domain reinvents the wheel and aggregation across domains becomes painful.

**Generic base type** (`src/types/feedback.ts`):

```typescript
export type ArtifactDomain = 'search' | 'prep' | 'cover-letter' | string

export type FeedbackRating = 'up' | 'down'

/** Dimensions any feedback event can carry — domain-specific data lives in `payload`. */
export interface FeedbackBase<TDomain extends ArtifactDomain = ArtifactDomain, TPayload = unknown> {
  id: string
  domain: TDomain
  artifactId: string               // runId, deckId, letterId, etc.
  targetId?: string                // resultId within a run, cardId within a deck, etc.
  rating: FeedbackRating
  reason?: string
  payload?: TPayload               // Domain-specific structured signal
  appliedToIdentity: boolean
  appliedAtVersion?: number        // Identity version when absorption happened
  reflectedInArtifactId?: string   // Which new artifact first incorporated this (thesis id, etc.)
  createdAt: string
}
```

**Per-domain payloads** extend the base:

```typescript
// Search (replaces standalone SearchFeedbackEvent payload from TASK-163)
export interface SearchFeedbackPayload {
  skill?: { name: string; suggestedDepth?: string }
  preference?: { category: 'prioritize' | 'avoid'; label: string; condition?: string }
  vector?: { title: string; thesis?: string }
}
export type SearchFeedbackEvent = FeedbackBase<'search', SearchFeedbackPayload>

// Prep
export interface PrepFeedbackPayload {
  skillDepth?: { name: string; suggestedDepth?: string }    // "I don't actually know Rust well"
  calibration?: { group: string; note: string }              // "not a k8s admin"
  storyFraming?: { cardId: string; note: string }            // "this story should emphasize X"
  interviewer?: { name: string; correction: string }         // Debrief-time correction
}
export type PrepFeedbackEvent = FeedbackBase<'prep', PrepFeedbackPayload>

// Cover letter (when it ships)
export interface CoverLetterFeedbackPayload {
  voice?: { facet: string; note: string }                    // "too formal", "too casual"
  positioning?: { aspect: string; note: string }
  fact?: { text: string; correction: string }
}
export type CoverLetterFeedbackEvent = FeedbackBase<'cover-letter', CoverLetterFeedbackPayload>
```

**Store unification:**

Consolidated feedback store (or per-domain stores using the shared type):

```typescript
// Single store approach
interface FeedbackState {
  events: FeedbackBase[]           // Heterogeneous by domain
  addEvent: (event: Omit<FeedbackBase, 'id' | 'createdAt'>) => FeedbackBase
  markApplied: (id: string, identityVersion: number) => void
  markReflectedInArtifact: (ids: string[], artifactId: string) => void
  getUnreflected: (domain: ArtifactDomain, currentArtifactId?: string) => FeedbackBase[]
  getEventsForArtifact: (artifactId: string) => FeedbackBase[]
}
```

**Migration plan:**

1. Land TASK-163 (SearchFeedbackEvent) as-is first
2. This task extracts the generic base when adding `PrepFeedbackEvent` (or whenever the second domain is needed)
3. `SearchFeedbackEvent` becomes a type alias: `FeedbackBase<'search', SearchFeedbackPayload>` — no data migration required since fields align

**Why unify at all:**
- Cross-domain aggregation: "what does the identity model need updating based on ALL feedback?" is a common query
- doc-26's dependency graph has identity at the root — feedback must flow back from any artifact, not just search
- Reduces per-domain implementation cost when new artifact types (interview debrief, portfolio deck, etc.) need feedback
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Generic FeedbackBase<TDomain, TPayload> type defined in src/types/feedback.ts
- [x] #2 SearchFeedbackEvent refactored to a type alias: FeedbackBase<'search', SearchFeedbackPayload>
- [x] #3 PrepFeedbackEvent defined with PrepFeedbackPayload covering skillDepth, calibration, storyFraming, interviewer
- [x] #4 Shared store contract supports addEvent, markApplied, markReflectedInArtifact, getUnreflected, getEventsForArtifact
- [x] #5 Backward-compatible: existing SearchFeedbackEvent consumers compile unchanged
- [x] #6 Tests cover: per-domain event creation, cross-domain query, identity-version writeback tracking
- [x] #7 doc-26 (shepherding) references the unified pattern; per-stage sections point here for feedback-event details
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Implement the unified feedback type foundation in a narrow slice: add generic feedback types, refactor SearchFeedbackEvent to the shared base without changing existing consumers, define PrepFeedbackEvent payloads, add a small reusable feedback collection contract/helper for cross-domain queries and writeback state, cover it with focused tests, update doc-26 references, then run targeted typecheck/lint/tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented unified feedback foundation: added src/types/feedback.ts with FeedbackBase/FeedbackApplicationState, PrepFeedbackEvent, CoverLetterFeedbackEvent, and shared FeedbackStateContract; added createFeedbackCollection helper with cross-domain add/apply/reflect/query operations; projected SearchFeedbackEvent onto the shared base while preserving runId/resultId/dimensions consumers; documented doc-26 unified feedback event guidance. Verification: npx vitest run src/test/feedbackStore.test.ts src/test/searchStore.test.ts passed 55/55; npm run typecheck passed; touched-file eslint passed; npm run build passed with existing chunk warnings. Full npm run test remains known baseline debt from unrelated suites, so DoD #3 remains unchecked per owner guidance. Review receipts: .agents/reviews/review-20260508-054453.md and .agents/reviews/test-audit-20260508-054459.md; feedback-specific findings were remediated, remaining broad searchStore findings are outside TASK-172.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Unified feedback event types and helper contract are in place across search/prep/cover-letter domains. Search feedback remains backward-compatible for existing consumers while carrying canonical domain/artifact/payload fields, and focused coverage now pins per-domain creation, cross-domain queries, writeback tracking, reflection semantics, migration hardening, and immutable helper snapshots.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
