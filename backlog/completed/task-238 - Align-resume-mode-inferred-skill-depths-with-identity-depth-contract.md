---
id: TASK-238
title: Align resume-mode inferred skill depths with identity depth contract
status: Done
assignee:
  - '@codex'
created_date: '2026-05-07 00:44'
updated_date: '2026-05-27 12:27'
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
- [x] #1 Resume-mode skill depth output is either aligned with the identity depth contract or the intentional subset is documented with a type-level guard.
- [x] #2 Focused tests cover the chosen contract.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-05-27 Codex starting combined push with TASK-234/TASK-235. Decision to verify before implementation: prefer aligning resume-mode inferred skill depths to the identity depth contract unless the live prompt/normalizer clearly needs a documented subset. Will update focused tests and gates/review/audit before close.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
2026-05-27 completed in commit 7a6bb81. Decision: align resume-mode inferred skill depths to the identity ProfessionalSkillDepth contract rather than preserving a subset. SearchSkillDepth now aliases ProfessionalSkillDepth; resume-mode prompt/validator accept the full identity depth set and normalize common LLM casing/space/underscore variants while filtering invalid or non-string depths. Verification: focused Vitest 174/174 pass, npm run typecheck, npm run lint, npm run build; search-depth diff test audit reports no prioritized gaps.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Depth-contract decision is stated before implementation: align to identity depths or document an intentional subset.
- [x] #2 Focused tests cover resume-mode depth prompt/normalization contract.
- [x] #3 Touched files are formatted.
- [x] #4 Focused lint and typecheck pass for touched files.
- [x] #5 Final summary records whether the subset was aligned or intentionally preserved.
<!-- DOD:END -->
