---
id: TASK-158
title: Add artifact staleness detection and refresh triggers
status: To Do
assignee: []
created_date: '2026-04-19 06:04'
labels:
  - shepherding
  - staleness
  - refresh
milestone: m-27
dependencies:
  - TASK-151.1
  - TASK-154
references:
  - src/store/identityStore.ts
  - src/store/prepStore.ts
  - src/store/searchStore.ts
documentation:
  - 'backlog doc-26: Cross-Cutting Fresh-Context Critique Triggers'
  - 'backlog doc-26: Dependency Graph'
  - 'backlog doc-21: Discovery 3 Fresh-Context Self-Critique'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When the identity model changes (skill depth corrected, calibration added, vector changed), downstream artifacts (cover letters, prep decks, search thesis) may be stale. Build the detection and refresh mechanism.

**Staleness detection** (start simple):
1. Each generated artifact records which identity model version it was generated from (timestamp or version counter)
2. When the identity model changes, compare artifact versions to current identity version
3. Flag stale artifacts with a non-blocking notification

**Refresh triggers** (doc-26, Cross-Cutting section):
- Skill depth corrected → flag cover letters and prep cards referencing that skill
- New vector added → flag search thesis
- Target vector changed on pipeline entry → flag that entry's cover letter and prep deck
- Significant identity model change → flag all downstream artifacts
- Post-debrief → flag next round's prep deck
- Post-rejection with pattern → flag search thesis lane priorities

**UX for refresh prompts:**
- Non-blocking badge or banner (NOT a modal)
- Batch review: "3 artifacts may be stale. Review?"
- Show diff of what changed and WHY: "your K8s depth correction changed this sentence"
- One-click accept/reject per artifact
- "Refresh" action runs a fresh-context critique pass on the artifact with latest identity context

**Implementation approach:**
- Start with timestamp-based staleness (simple, low risk)
- Add field-level change tracking later (which specific fields changed)
- Start with manual "Refresh" button, add automatic suggestions once detection logic is proven

This is the mechanism that makes corrections feel like progress — the user sees immediate downstream impact from every correction.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Generated artifacts record the identity model version they were created from
- [ ] #2 When identity model changes, stale artifacts are identified by version comparison
- [ ] #3 Non-blocking notification surfaces stale artifact count
- [ ] #4 User can review stale artifacts with diff showing what changed and why
- [ ] #5 One-click accept/reject per artifact in batch review
- [ ] #6 Refresh action regenerates artifact with latest identity context (fresh-context critique)
- [ ] #7 Skill depth correction triggers staleness check on cover letters and prep cards referencing that skill
- [ ] #8 Search thesis flagged as stale when vectors or skill depths change
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
