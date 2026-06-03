---
id: TASK-222
title: 'Phase 5: emit asserted audience tags from JdMatchExtraction LLM prompt'
status: Done
assignee:
  - '@codex'
created_date: '2026-05-06 07:33'
updated_date: '2026-05-26 06:54'
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
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-05-26 Codex starting TASK-222. Plan: map JdMatchExtraction prompt/schema/normalization, preserve asserted audience semantics (null vs [] vs populated), keep rules-based inference as fallback floor, add focused parser/pipeline tests, run gates plus independent review/audit, commit/close.

2026-05-26 Codex completed TASK-222 implementation. JD match extraction prompt now asks for audiences.asserted on requirements, advantage hypotheses, positioning recommendations, gap focus, and warnings. Parser preserves asserted null vs [] vs populated tags, sanitizes malformed tags, supports legacy string note arrays, and carries hypothesis audiences through generated report advantages. Rules-based inference remains the floor through createJdAnalysisFromMatchArtifacts/applyRulesBasedAudiences.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented Phase 5 asserted audience extraction for JD matching. Updated the decomposition prompt contract, parser normalization, and advantage propagation so LLM asserted tags can enter the canonical JDAnalysis pipeline while rules-based inferred audiences remain intact. Added tests for prompt contract, valid/empty/malformed asserted semantics, omitted audience fallback, legacy string notes, malformed note validation, report advantage propagation, and JDAnalysis rules preservation. Verification: format:files, typecheck, focused jobMatch/JDAnalysis/audience tests, lint, build, independent source review PASS WITH ISSUES only P3 unused-import false positive, diff test audit no gaps.
<!-- SECTION:FINAL_SUMMARY:END -->
