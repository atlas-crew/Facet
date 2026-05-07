---
id: TASK-238
title: Align resume-mode inferred skill depths with identity depth contract
status: To Do
assignee: []
created_date: '2026-05-07 00:44'
updated_date: '2026-05-07 00:48'
labels:
  - refactor
  - search-redesign
  - cleanup
dependencies: []
references:
  - src/utils/searchProfileInference.ts
documentation:
  - >-
    backlog/tasks/task-206 -
    Verify-searchProfileInference-resume-mode-has-no-live-callers-and-retire-if-dead.md
  - docs/architecture/identity-canonical-data.md
  - backlog decision-3 (Identity is canonical for candidate-only data)
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-206 verified inferSearchProfile resume mode is still active through ResearchPage when currentIdentity is null. Because resume mode remains live, the audit's depth enum subset mismatch did not vanish through retirement. Align the resume-mode prompt/normalizer with the identity skill-depth contract or explicitly document and guard an intentional subset.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Resume-mode skill depth output is either aligned with the identity depth contract or the intentional subset is documented with a type-level guard.
- [ ] #2 Focused tests cover the chosen contract.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Depth-contract decision is stated before implementation: align to identity depths or document an intentional subset.
- [ ] #2 Focused tests cover resume-mode depth prompt/normalization contract.
- [ ] #3 Touched files are formatted.
- [ ] #4 Focused lint and typecheck pass for touched files.
- [ ] #5 Final summary records whether the subset was aligned or intentionally preserved.
<!-- DOD:END -->
