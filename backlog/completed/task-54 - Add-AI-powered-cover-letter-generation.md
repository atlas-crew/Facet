---
id: TASK-54
title: Add AI-powered cover letter generation
status: Done
assignee: []
created_date: '2026-03-10 21:17'
updated_date: '2026-03-10 21:50'
labels:
  - resume-builder
  - ui
  - ai
milestone: m-5
dependencies: []
references:
  - /Users/nferguson/Developer/resume-builder/src/routes/letters/LettersPage.tsx
  - /Users/nferguson/Developer/resume-builder/src/utils/prepGenerator.ts
  - /Users/nferguson/Developer/resume-builder/src/store/pipelineStore.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Wire the Letters experience to the existing AI proxy so a user can generate a cover letter draft from a selected pipeline opportunity and resume vector, then edit the generated template in the existing cover letter editor.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Letters page can generate a new cover letter template using the configured AI proxy.
- [x] #2 Generated cover letter uses selected pipeline opportunity data and selected resume vector context.
- [x] #3 Feature is covered by tests and validated with typecheck, test, and build receipts; repo-wide lint debt is tracked separately in TASK-56 through TASK-59.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented AI-powered cover letter generation in LettersPage via the existing AI proxy, using selected pipeline opportunity data plus assembled resume/vector context.

Added src/utils/coverLetterGenerator.ts with schema validation and dedicated unit coverage.

Validation receipts: targeted eslint on touched files passed; npm run typecheck passed; npm run test passed (375 tests); npm run build passed.

Repo-wide npm run lint still fails on pre-existing issues outside this feature (for example src/components/ComponentLibrary.tsx, src/components/Tour.tsx, src/store/resumeStore.ts, and other long-standing no-explicit-any/no-unused-vars violations).

Claude specialist review: .agents/reviews/review-20260310-172211.md (approve with changes, no critical blockers).

Claude test audit: .agents/reviews/test-audit-20260310-172211.md (feature happy path covered; substantial untested CRUD and validation branches remain on LettersPage).

Atomic commit created: dfe6621 (feat(letters): add ai cover letter generation).

Assigned to milestone m-5 during milestone reconciliation; this task supersedes TASK-33 as the active AI generation implementation record.

User removed the repo-wide lint gate for now; lint debt is tracked separately in TASK-56, TASK-57, TASK-58, and TASK-59 and should not block this feature task.

Broader LettersPage test gaps from the earlier successful audit are tracked separately in the follow-up task created for expanded LettersPage coverage, so they no longer block this milestone feature closure.

Formal Claude review/test-audit scripts were re-attempted on 2026-03-10 but failed due Claude CLI usage-limit errors; earlier successful review artifacts remain at .agents/reviews/review-20260310-172211.md and .agents/reviews/test-audit-20260310-172211.md.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 The project builds successfully
<!-- DOD:END -->
