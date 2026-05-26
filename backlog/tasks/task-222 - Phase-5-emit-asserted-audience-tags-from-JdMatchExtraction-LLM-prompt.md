---
id: TASK-222
title: 'Phase 5: emit asserted audience tags from JdMatchExtraction LLM prompt'
status: In Progress
assignee:
  - '@codex'
created_date: '2026-05-06 07:33'
updated_date: '2026-05-26 06:36'
labels:
  - audience-tagging
  - ai
  - phase-5
milestone: m-28
dependencies: []
references:
  - src/utils/jobMatch.ts
  - src/utils/audienceRules.ts
  - src/types/audience.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

The audience-tagging system has two layers of tag sources: rules-based `inferred` (always populated) and LLM-asserted `asserted` (currently always `null`). Phase 5 of the rollout enables the LLM to override the rules engine for cases the rules cannot handle (e.g., a Hook that's recruiter-only-because-the-content-is-pitch-language, not because of the field's default audience).

Until Phase 5 ships, the `asserted` field stays `null`. The distinction between `null` ("LLM hasn't shipped") and `[]` ("LLM ran, no override") is load-bearing for eval queries — keep both.

## What

Update the `JdMatchExtraction` LLM prompt in `src/utils/jobMatch.ts` to emit `audiences.asserted` per insight. Include discriminating examples in the prompt:
- Recruiter-only content: Hook, Suggested Intro
- HM-only vs both
- Candidate-only: Notes, Concerns
- Internal-only: data-quality flags

Keep `applyRulesBasedAudiences` running before AND after extraction for fallback when the LLM omits or returns malformed audiences.

## Acceptance criteria

- LLM prompt emits structured audience tags per insight type
- Generator preserves `asserted` distinction (`null` vs `[]` vs populated)
- Rules engine still runs as a floor — never produces unclassified outputs in production
- Unit tests verify `asserted` propagation through the pipeline
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-05-26 Codex starting TASK-222. Plan: map JdMatchExtraction prompt/schema/normalization, preserve asserted audience semantics (null vs [] vs populated), keep rules-based inference as fallback floor, add focused parser/pipeline tests, run gates plus independent review/audit, commit/close.
<!-- SECTION:NOTES:END -->
