---
id: TASK-43
title: Wire cover letter contact links from resume meta
status: Done
assignee: []
created_date: '2026-03-10 03:53'
updated_date: '2026-03-10 21:50'
labels:
  - feature
  - letters
milestone: m-5
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`src/engine/letterAssembler.ts` currently emits `contactLinks: []` even when resume meta has links. Use meta links (label+url) as the canonical source so cover letter PDF headers include GitHub/LinkedIn/portfolio consistently.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Cover letter assembly pulls contact links from resume meta (and preserves ordering).
- [x] #2 Invalid/unsafe URLs are dropped (use existing URL sanitization rules).
- [x] #3 Cover letter PDF output renders these links and they are clickable.
- [x] #4 Unit tests cover assembly + rendering expectations.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Wired cover letter contact links from resume meta inside assembleCoverLetterData by reusing link display formatting plus URL normalization/sanitization. Bare domains are normalized to https:// and unsafe schemes are dropped. Added unit coverage in src/test/letterAssembler.test.ts and PDF payload coverage in src/test/letterPdfRenderer.test.ts to verify clickable link payload reaches the letter Typst template.

Validation receipts: npx eslint src/engine/letterAssembler.ts src/test/letterAssembler.test.ts src/test/letterPdfRenderer.test.ts passed.

Validation receipts: npm run typecheck passed.

Validation receipts: npm run test passed (377 tests).

Validation receipts: npm run build passed.

Formal Claude review/test-audit scripts were attempted on 2026-03-10 but failed due Claude CLI usage-limit errors after creating partial output files under .agents/reviews/.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [ ] #2 Documentation has been created/modified/removed as needed.
- [ ] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [ ] #4 Test changes were approved by a test gap analysis review
- [x] #5 Changes to integration points are covered by tests
- [x] #6 All tests pass successfully
- [x] #7 Automatic formatting was applied.
- [ ] #8 Linters report no WARNINGS or ERRORS
- [x] #9 The project builds successfully
<!-- DOD:END -->
