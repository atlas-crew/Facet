---
id: TASK-99
title: Tighten identity page workbench layout
status: Done
assignee:
  - '@codex'
created_date: '2026-04-10 18:25'
updated_date: '2026-04-10 22:35'
labels:
  - ui
  - identity
dependencies: []
references:
  - src/routes/identity/IdentityPage.tsx
  - src/routes/identity/identity.css
  - src/routes/identity/ExtractionAgentCard.tsx
  - src/routes/identity/IdentityModelBuilderCard.tsx
  - src/test/IdentityPage.test.tsx
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Adjust the top identity page workbench so the Extraction Agent gets more horizontal space while the Identity Model Builder card sizes to its own content instead of stretching to the full row height.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The top identity page workbench gives the Extraction Agent more width than the Identity Model Builder card on desktop layouts.
- [x] #2 The Identity Model Builder card does not visually stretch to match a much taller neighboring Extraction Agent card.
- [x] #3 Responsive behavior remains intact and a focused test covers the new layout hook.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Give the top identity workbench its own grid modifier so the Extraction Agent gets more width on desktop while preserving the stacked mobile layout.
2. Keep the draft JSON editor mounted, but collapse its empty state so the Identity Model Builder no longer reserves a tall empty code panel before a draft exists.
3. Add a focused IdentityPage regression test for the workbench layout hook and empty-draft builder state, then rerun targeted verification.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Independent source review passed clean in .agents/reviews/review-20260410-143213.md after one remediation cycle.

Independent test audit in .agents/reviews/test-audit-20260410-143527.md surfaced broader pre-existing IdentityPage failure-path coverage debt; tracked separately in TASK-100 so this UI slice can stay atomic.

User reported the first pass still looked effectively unchanged. Live DOM verification at 1200px showed the workbench applied but the builder still rendered at roughly 390px wide by 625px tall, so a second pass is tightening the pristine empty state and increasing extraction-column priority.

Second pass live verification at 1600px measured the workbench at 861px for Extraction Agent and 340px for Identity Model Builder, with the builder compact state at roughly 311px tall.

Follow-up commit fix(identity): compact empty builder state adds a true compact pristine mode, disclosure semantics, explicit expand/collapse controls, and a stronger desktop width split after the user reported the first pass still looked unchanged.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rebalanced the top identity workbench so the Extraction Agent gets a wider desktop column while the Identity Model Builder no longer stretches around an empty draft state. The builder now keeps its JSON editor mounted, shrinks the empty editor height, disables validation until content exists, and shows inline guidance before a draft is generated. Added a focused IdentityPage regression test for the workbench layout hook and compact empty-draft state. Verification: npx vitest run src/test/IdentityPage.test.tsx, npm run typecheck, npm run build. Review receipts: .agents/reviews/review-20260410-143213.md (clean source review), .agents/reviews/test-audit-20260410-143527.md (broader pre-existing IdentityPage test debt tracked in TASK-100).

Second pass after live browser verification: the pristine empty builder now stays compact behind an Open JSON Editor disclosure instead of rendering a tall empty editor by default, and the desktop workbench now biases much more heavily toward the Extraction Agent column.

Updated focused coverage in src/test/IdentityPage.test.tsx for both the compact state and the open-editor transition; reran npx vitest run src/test/IdentityPage.test.tsx and npm run typecheck.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
