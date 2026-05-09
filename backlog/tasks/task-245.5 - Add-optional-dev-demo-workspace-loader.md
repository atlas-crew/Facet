---
id: TASK-245.5
title: Add optional dev demo workspace loader
status: Done
assignee:
  - '@codex'
created_date: '2026-05-08 23:28'
updated_date: '2026-05-09 04:52'
labels:
  - feature
milestone: m-29
dependencies:
  - TASK-245.2
documentation:
  - backlog/docs/doc-43 - Golden-E2E-Fixture-Coverage-Plan.md
modified_files:
  - src/dev/goldenDemoWorkspace.ts
  - src/components/WorkspaceBackupDialog.tsx
  - src/test/goldenDemoWorkspace.test.ts
  - src/test/WorkspaceBackupDialog.test.tsx
  - src/test/fixtures/goldenWorkspace.ts
  - src/test/fixtures/goldenWorkspace.test.ts
  - src/index.css
  - backlog/docs/doc-43 - Golden-E2E-Fixture-Coverage-Plan.md
parent_task_id: TASK-245
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decide and implement the developer/demo loading path for the golden workspace. This should be optional and explicit, not a replacement for route-local sample data unless the UX is intentionally changed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A decision is recorded on whether the loader is dev-only, test-only, or user-visible as Load Demo Workspace.
- [x] #2 If implemented in UI, the loader hydrates all required stores coherently and warns/replaces existing local data deliberately.
- [x] #3 Existing Build and Pipeline route-local Load Sample Data actions keep their documented behavior unless deliberately superseded.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented the optional loader as a dev-only Backup dialog import-mode action: Replace with Demo Workspace. The action dynamically imports src/dev/goldenDemoWorkspace.ts only when import.meta.env.DEV is true, replaces the active workspace through runtime.importWorkspaceSnapshot(..., { mode: 'replace' }), then hydrates Maya identity explicitly. Build and Pipeline route-local Load Sample Data actions were not changed. Decision recorded in doc-43. Review finding about production Help mentioning the dev-only action was remediated by removing that mention from the user guide; production build grep for Replace with Demo Workspace, goldenDemoWorkspace, and Maya Patel Golden Workspace returned no matches. Verification: npx vitest run src/test/goldenDemoWorkspace.test.ts src/test/WorkspaceBackupDialog.test.tsx src/test/fixtures/goldenWorkspace.test.ts src/test/fixtures/personas/validate.test.ts src/test/fixtures/personas/validate.negative.test.ts; npx eslint focused files; npm run typecheck -- --pretty false; npx vite build --mode production --outDir /tmp/facet-task245-loader-prod-check; git diff --check.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Dev-only golden demo workspace loader is available from Backup import mode, with replacement semantics, explicit Identity hydration, tests, and production Help drift remediated.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 Automatic formatting was applied to touched files
- [x] #4 Regression tests pass (scoped to touched files)
- [x] #5 Linters report no warnings or errors in touched files
- [x] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
