---
id: TASK-286
title: >-
  Document extractJsonBlock behavior with array responses in proposeAnswerPatch
  tests
status: To Do
assignee: []
created_date: '2026-06-07 01:43'
labels:
  - quality
milestone: m-34
dependencies: []
references:
  - src/test/identityParametersGeneration.test.ts
  - .agents/reviews/test-audit-20260606-214016.md
priority: low
ordinal: 42000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Source:** Test Audit (TASK-278, iteration 1) — P2-001
**Severity:** P2

The `parseGeneratedPayload` guard `Array.isArray(parsed)` that would throw "must be a JSON object" is unreachable in practice via `proposeAnswerPatch` because `extractJsonBlock` extracts the inner `{}` from an `[{}]` array response rather than treating the array as the top-level value. The guard does fire if the JSON is a primitive (number, string, null) at the top level.

The boundary test added in the P1 remediation round documents the actual behavior (`[{}]` → "unknown kind") with a comment, but the unreachability of the array guard in `parseGeneratedPayload` itself is worth either a focused comment in the source or a dedicated test with a primitive-valued response.

### Suggested approach
Add a test with a primitive JSON response (e.g. `"42"`) to verify `parseGeneratedPayload` throws "must be a JSON object" via `proposeAnswerPatch`. Or add a comment in `parseGeneratedPayload` noting that the Array guard is primarily exercised by callers that produce bare-array responses (not array-wrapped objects).

### Acceptance criteria
- Either a passing test exercising the `Array.isArray` guard, or a code comment documenting the reachability conditions
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Regression tests pass (scoped to touched files)
- [ ] #5 Linters report no warnings or errors in touched files
- [ ] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
