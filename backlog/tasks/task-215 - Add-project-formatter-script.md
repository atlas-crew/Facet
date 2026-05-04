---
id: TASK-215
title: Add project formatter script
status: Done
assignee:
  - Codex
created_date: '2026-05-04 22:34'
updated_date: '2026-05-04 22:45'
labels:
  - tooling
  - quality
dependencies: []
references:
  - package.json
  - eslint.config.js
  - pnpm-lock.yaml
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a standard Prettier formatting setup so future tasks can satisfy the automatic-formatting Definition of Done without broad manual style churn.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The root package defines scripts to format files and check formatting without mutating files.
- [x] #2 Prettier is installed and configured to match the repository's existing TypeScript style.
- [x] #3 Generated output, dependency folders, and agent artifacts are excluded from formatting.
- [x] #4 ESLint is configured to avoid conflicts with Prettier-managed formatting rules.
- [x] #5 Verification proves the formatter check, lint, and typecheck pass for the setup.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add Prettier and eslint-config-prettier as root dev dependencies using pnpm so pnpm-lock.yaml stays authoritative.
2. Add root `.prettierrc` and `.prettierignore` with the repo's existing no-semicolon, single-quote, 2-space TypeScript style and exclusions for generated/dependency/agent artifacts.
3. Add `format`, `format:check`, and targeted formatting scripts to package.json, then extend eslint.config.js with eslint-config-prettier.
4. Run the new formatter check and targeted formatting on the formatter setup files, then run lint/typecheck/build as appropriate.
5. Update TASK-215 and commit only formatter setup files with `cortex git commit`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added Prettier plus eslint-config-prettier, root `.prettierrc` with schema/no-semicolon/single-quote/trailing-comma settings, `.prettierignore` exclusions for generated outputs, agent artifacts, locks, brand exports, and Backlog.md-managed files, and package scripts for project-wide formatting plus scoped file formatting.

Verification passed: `pnpm format:files -- package.json eslint.config.js .prettierrc`, `pnpm format:files:check -- package.json eslint.config.js .prettierrc`, `pnpm exec eslint eslint.config.js`, `pnpm typecheck`, `pnpm build`, and `git diff --check` on touched files. `pnpm format:check` now runs as a real project-wide check but currently fails on the pre-existing unformatted baseline (411 files after ignores); baseline formatting should be a separate dedicated commit if we want to enable it as a gate.

Independent review passed with no P0/P1 blockers after remediation: `.agents/reviews/review-20260504-184330.md`. Remaining P2/P3 notes were about optional baseline-format policy, scoped script naming, and brand formatting policy.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the project formatter setup: Prettier dependencies/config, Prettier ignore rules, package scripts for project-wide and scoped formatting checks, and eslint-config-prettier at the end of the flat ESLint config. Verified scoped formatting, targeted lint, typecheck, build, and diff whitespace. Project-wide `pnpm format:check` is available but exposes the existing unformatted baseline, so a later dedicated baseline-format commit is still needed before using it as a CI gate.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
