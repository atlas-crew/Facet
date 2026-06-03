---
id: TASK-243
title: Decide and execute import flow's final form factor
status: Done
assignee: []
created_date: '2026-04-30 18:41'
updated_date: '2026-05-08 20:53'
labels:
  - identity
  - map-convergence
  - strategy-d
  - import-flow
dependencies: []
references:
  - src/routes/identity/IdentityPage.tsx
  - src/routes/identity/IdentityMapPage.tsx
  - src/router.tsx
parent_task_id: TASK-202
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context (TASK-202 phase 4)

Strategy D commits to "Map is the canonical-edit surface; workbench route exists only for import." It deliberately does **not** pre-commit to the import flow's final form factor. Three reasonable shapes:

1. **Route-but-ephemeral.** Workbench stays as a route (possibly renamed `/identity/workbench` → `/identity/import`). Map provides a one-way ticket via "+ Import" affordance. After Apply, auto-redirect to Map. Familiar, low-risk; minimal architectural change.
2. **Sheet flow on the Map.** Generalize 202.1's sheet primitive to host multi-stage async flows (PDF upload → scan progress → review → apply). Higher ambition; tighter integration; risk of stretching the sheet primitive past what it's good at.
3. **Full-screen overlay / modal wizard.** Map renders an overlay covering the band content during import; closes on Apply or cancel. Clearer "this is a temporary mode" affordance; possibly heavier to build.

Decision depends on how 202.1's sheet primitive feels in practice. If it handles single high-content edits well, generalizing to multi-stage import is plausible. If it's compact-only, route-but-ephemeral is the right answer.

This task is **Draft** until 202.1 lands and we have lived experience with the sheet primitive.

## Approach (when activated)

1. Review 202.1's deliverable; assess whether the sheet primitive scales to multi-stage async.
2. Pick form factor; record reasoning.
3. Execute:
   - If route-but-ephemeral: rename if applicable; add Map-side "+ Import" topbar action; auto-redirect after Apply
   - If sheet flow: extend sheet primitive for multi-stage; mount on Map; delete workbench route
   - If overlay: build overlay component; mount on Map; delete workbench route
4. Update tests for the import flow.
5. Verify no other route or component depends on the workbench route still existing in its current shape.

## Out of scope

- ScannedIdentityEditor's fate. That's 202.3.
- Any new import features (e.g., LinkedIn import). Strictly about form-factor for the existing PDF flow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Form factor decided with reasoning grounded in 202.1's actual experience (not speculation)
- [x] #2 Workbench route either renamed to reflect import-only role OR deleted with its functionality moved into a Map-side affordance
- [x] #3 Map provides a discoverable Import affordance (topbar button or empty-state CTA) that triggers the import flow in its new form
- [x] #4 After Apply, user lands on Map with the new identity visible; no manual nav step required
- [x] #5 Import flow's existing async stages (PDF parse → scan review → optional draft → apply) all work in the new form factor; regression-tested
- [x] #6 Tests cover the full import → apply → land-on-Map happy path plus the cancel-mid-import case
<!-- AC:END -->



## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Recommended skill loadout for picking up this task

**Always-load:**
- `backlog-md` — record the form-factor decision in notes before implementing; promote this draft to a regular task at that point
- `atomic-commits` — form-factor decision (notes), implementation, route renames, and test updates are separate commits
- `verification-before-completion` — multi-stage async flows need real-browser verification, not just unit tests
- `codanna-codebase-intelligence` — find every consumer of the workbench route (Map's "Start from a resume" button, deep-link references, tests)

**Phase-specific:**
- `interaction-design` — the form-factor question is fundamentally about flow design (route vs sheet vs overlay)
- `ux-review` — multi-perspective check before committing; modals, sheets, and routes each have distinct UX cost profiles for multi-stage async
- `webapp-testing` — Playwright e2e for the full PDF-upload → scan → review → apply → land-on-Map flow; unit tests can't catch the navigation seams
- `decision-maker` — same shape of choice as TASK-202.2: options × criteria × reasoning

**Note:** This task is **Draft** because the form-factor decision genuinely depends on TASK-202.1's lived experience with the sheet primitive. Don't activate until 202.1 has landed and someone has used the sheet for source_text editing in real conditions.

## Form-factor decision (2026-05-08)

Decision: route-but-ephemeral.

Reasoning:
- The InspectorSheet primitive has worked well for one focused high-content field next to an already-selected Map entity, but the import flow is multi-stage async work: upload, parse progress, scan review, optional draft generation, apply, and cancellation.
- Keeping import on a focused route preserves the existing tested async lifecycle and avoids stretching the sheet primitive into a wizard/container primitive.
- Strategy D still holds because the route is import-only: the Map remains the canonical edit surface, and the import route should return users to Map after Apply.
- The next implementation slice should rename or alias the route to the import-only role, keep the Map topbar import affordance, and auto-navigate to Map after apply.

## Route-but-ephemeral implementation completed (2026-05-08)

Implementation:
- Renamed the import/review route from /identity/workbench to /identity/import in router.tsx.
- Updated IdentityMapPage topbar and empty-state import affordances to navigate to /identity/import.
- Updated Prep identity-draft handoffs to navigate queued drafts to /identity/import.
- IdentityPage now navigates to /identity after a successful Apply, so the newly applied identity lands on the canonical Map.
- Updated route comments to remove the deferred import-overlay/search-param language.

Verification:
- npx vitest run src/test/IdentityMapPage.deepLink.test.tsx: PASS, 23 tests.
- npx vitest run src/test/IdentityPage.test.tsx -t "uploads a PDF|returns to the Identity Map|does not finalize a bulk|aborts an in-flight|deepens all scanned|cancels bulk|switches the detail|disables bullet": PASS, 8 tests / 19 skipped.
- npx vitest run src/test/PrepPage.behavior.test.tsx -t "Queue for Identity Review|queues prep answers into the identity draft": PASS, 1 test / 13 skipped.
- npx vitest run src/test/PrepPage.identityGeneration.test.tsx -t "captures context gap answers and queues an identity draft": PASS, 1 test / 8 skipped.
- npm run typecheck: PASS.
- npx eslint on touched route/page/test files: PASS.
- npm run format:files/check on touched route/page/test files: PASS after formatting.
- npm run build: PASS, with existing large-chunk warnings.

Full suite note:
- Repo-wide npm run test was not rerun in this slice because existing unrelated full-suite failures were already documented by TASK-89 and TASK-114.4. The import-flow route/apply/Prep handoff surfaces touched here have targeted passing coverage.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
