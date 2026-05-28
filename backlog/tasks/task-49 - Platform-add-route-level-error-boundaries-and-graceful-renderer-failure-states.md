---
id: TASK-49
title: >-
  Platform: add route-level error boundaries and graceful renderer failure
  states
status: In Progress
assignee:
  - '@codex'
created_date: '2026-03-10 03:54'
updated_date: '2026-05-28 06:26'
labels:
  - remediation
  - ux
milestone: m-1
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add error boundaries around routes and key renderer surfaces (Typst preview, JD analysis) so failures degrade gracefully with recovery actions instead of blank screens.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each route has an error boundary that shows a helpful fallback UI and a recovery action.
- [ ] #2 Typst/JD analysis errors surface as non-blocking notices with clear next steps.
- [ ] #3 No new uncaught runtime errors are introduced in happy-path flows.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified existing TASK-49 implementation in branch: default TanStack route error component via RouteErrorFallback with retry/overview/reload actions; PdfPreview keeps stale successful renders and surfaces Typst/render errors as non-blocking alerts with next steps; Pipeline/Build JD-analysis failures already surface inline/toast guidance without blocking unrelated flows. Follow-up committed CSS placement fix for route/PDF fallback styles. Verification: npx vitest run src/test/RouteErrorFallback.test.tsx src/test/PdfPreview.test.tsx src/test/PipelinePage.test.tsx src/test/BuildPage.test.tsx (75 passing); npx eslint route/PDF/pipeline touched surfaces; npm run lint; npm run build.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Documentation has been created/modified/removed as needed.
- [ ] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [ ] #4 Test changes were approved by a test gap analysis review
- [ ] #5 Changes to integration points are covered by tests
- [ ] #6 All tests pass successfully
- [ ] #7 Automatic formatting was applied.
- [ ] #8 Linters report no WARNINGS or ERRORS
- [ ] #9 The project builds successfully
<!-- DOD:END -->
