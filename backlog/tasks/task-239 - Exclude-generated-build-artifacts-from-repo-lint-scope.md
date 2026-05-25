---
id: TASK-239
title: Exclude generated build artifacts from repo lint scope
status: Done
assignee:
  - '@codex'
created_date: '2026-05-07 00:45'
updated_date: '2026-05-25 13:55'
labels:
  - bug
  - cleanup
  - tooling
dependencies: []
references:
  - eslint.config.js
documentation:
  - >-
    backlog/tasks/task-206 -
    Verify-searchProfileInference-resume-mode-has-no-live-callers-and-retire-if-dead.md
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-206 verification confirmed direct focused ESLint passes, but npm run lint expands to eslint . and reports generated .vercel/dist-unmin artifacts plus existing repository lint debt. Tighten lint inputs/ignores so generated build outputs do not mask actionable source lint failures.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 npm run lint no longer traverses generated .vercel or dist-unmin build artifacts.
- [x] #2 Any remaining source lint debt is reported separately from generated artifact noise.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-05-25 Codex starting TASK-239 in branch codex/task-239. Plan: inspect current ESLint ignore/config and package lint command; reproduce or identify generated-artifact traversal for .vercel/dist-unmin; tighten lint ignores/input scope without masking source lint; run focused config checks plus npm run lint to separate generated artifact noise from remaining source debt; format touched config/docs; commit with cortex git commit and close task with exact lint receipts.

2026-05-25 closeout: tightened ESLint flat-config global ignores for generated outputs so eslint . ignores root/nested .vercel artifacts, dist/dist-* and explicit dist-unmin variants, plus coverage output. Verification: pnpm exec eslint --print-config .vercel/output/static/chunk.ts, dist-unmin/assets/chunk.ts, and coverage/block-navigation.js each returned undefined (ignored); pnpm run lint exited 0 with no source or generated-artifact findings; pnpm exec prettier --check --ignore-unknown eslint.config.js passed; git diff --check passed. Independent review: bundled specialist-review failed before artifact due local mapfile shell incompatibility; Gemini fallback review artifact .agents/reviews/review-20260525-095207-gemini.md returned CLEAN with only low/informational notes.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Excluded generated lint artifacts in ESLint flat config by making .vercel, dist/dist-unmin, and coverage output ignores explicit and recursive. npm run lint now completes cleanly, and generated-artifact checks resolve to ignored config rather than entering the lint surface.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Generated build outputs are excluded from repo lint traversal.
- [x] #2 npm run lint verification distinguishes generated-artifact noise from remaining source lint debt.
- [x] #3 Touched config/documentation files are formatted.
- [x] #4 Final summary records the exact lint command results.
<!-- DOD:END -->
