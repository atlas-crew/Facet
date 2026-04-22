---
id: TASK-172
title: Unify feedback event pattern across search, prep, and letter domains
status: To Do
assignee: []
created_date: '2026-04-19 10:30'
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
- [ ] #1 Generic FeedbackBase<TDomain, TPayload> type defined in src/types/feedback.ts
- [ ] #2 SearchFeedbackEvent refactored to a type alias: FeedbackBase<'search', SearchFeedbackPayload>
- [ ] #3 PrepFeedbackEvent defined with PrepFeedbackPayload covering skillDepth, calibration, storyFraming, interviewer
- [ ] #4 Shared store contract supports addEvent, markApplied, markReflectedInArtifact, getUnreflected, getEventsForArtifact
- [ ] #5 Backward-compatible: existing SearchFeedbackEvent consumers compile unchanged
- [ ] #6 Tests cover: per-domain event creation, cross-domain query, identity-version writeback tracking
- [ ] #7 doc-26 (shepherding) references the unified pattern; per-stage sections point here for feedback-event details
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
