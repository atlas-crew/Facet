---
id: TASK-263
title: Proposed-vectors review pane and acceptance flow
status: To Do
assignee: []
created_date: '2026-05-11 05:20'
labels:
  - feature
  - identity
  - multi-source-intake
milestone: m-33
dependencies: []
modified_files:
  - src/routes/identity/ProposedVectorsCard.tsx
  - src/routes/identity/IdentityPage.tsx
  - src/store/identityStore.ts
  - src/types/identity.ts
  - src/test/ProposedVectorsCard.test.tsx
  - src/routes/identity/identity.css
priority: high
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a "Proposed Vectors" review surface to the Identity page that displays AI-inferred positioning vectors from multi-source synthesis and lets the user explicitly accept, edit, or reject each one. Accepted vectors land in `identity.search_vectors[]`; rejected vectors are discarded; the staging slot clears on draft acceptance.

CONTEXT (load-bearing decisions from m-33 milestone):
- "Wrong confident-AI output is worse than blank fields" applies hardest to vectors. A bad vector poisons every downstream resume assembled for that angle. EXPLICIT USER ACCEPTANCE is mandatory; no auto-write.
- This UI is the PROTOTYPE for the broader "AI-proposed identity fragment" pattern. When agent-dump arrives in Phase 3, Self Model suggestions will follow the same review-and-accept shape. Layout this pane with a future neighbor in mind so the second instance is a copy, not a redesign.

UI SHAPE (sketch):
- Section appears above ScanReviewPane when draft.proposedVectors is non-empty; hidden otherwise.
- Each proposed vector renders as a card showing: title, thesis, supporting_bullets (with role/bullet labels resolved), evidence_sources (e.g., "2 resumes labeled platform"), and three actions: Accept, Edit, Reject.
- Accept: validates the vector shape, promotes to draft.identity.search_vectors[] with proper id assignment, removes from staging.
- Edit: inline editor for title/thesis/keywords; user must save before accepting.
- Reject: removes from staging without promotion.

STORE SHAPE:
- draft.proposedVectors: ProposedSearchVector[] (transient on the draft, not persisted on identity).
- Selectors: hasProposedVectors, getProposedVectorById.
- Actions: acceptProposedVector(id), rejectProposedVector(id), editProposedVector(id, patch).

REFERENCES:
- Existing draft review surface: src/routes/identity/ScanReviewPane.tsx
- Existing identity page composition: src/routes/identity/IdentityPage.tsx
- ProfessionalSearchVector schema: src/identity/schema.ts (use the existing supporting_bullets field)
- Task 3 emits draft.proposedVectors
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 New component src/routes/identity/ProposedVectorsCard.tsx (or similarly-named) renders proposed vectors as a list of cards
- [ ] #2 Component appears in IdentityPage above ScanReviewPane only when draft.proposedVectors is non-empty
- [ ] #3 Each card displays: title, thesis, supporting_bullets resolved to readable role/bullet labels, evidence_sources strings, and three action buttons
- [ ] #4 Accept action promotes the vector to draft.identity.search_vectors[], assigning a stable id; removes from staging
- [ ] #5 Reject action removes the vector from staging without identity changes
- [ ] #6 Edit action opens an inline form for title/thesis/keywords; save validates and updates staging; cancel discards local edits
- [ ] #7 Empty staging slot hides the pane entirely (does not render an empty container)
- [ ] #8 Accepting all or rejecting all does not leave orphan state; draft.proposedVectors becomes []
- [ ] #9 When draft is applied to identity, any remaining proposedVectors are NOT carried over (the user must accept before applying)
- [ ] #10 Tests cover: render with proposed vectors, accept promotion to search_vectors, reject removal, edit-then-accept flow, empty-state hiding, draft-application clears staging
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Regression tests pass (scoped to touched files)
- [ ] #5 Linters report no warnings or errors in touched files
- [ ] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
