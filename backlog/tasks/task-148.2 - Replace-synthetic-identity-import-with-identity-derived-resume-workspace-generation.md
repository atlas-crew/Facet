---
id: TASK-148.2
title: >-
  Replace synthetic identity import with identity-derived resume workspace
  generation
status: Done
assignee:
  - Codex
created_date: '2026-04-18 11:00'
updated_date: '2026-04-18 08:04'
labels:
  - resume
  - build
  - identity
milestone: m-19
dependencies:
  - TASK-148.1
references:
  - src/identity/resumeAdapter.ts
  - src/identity/schema.ts
  - src/store/identityStore.ts
  - src/engine/serializer.ts
  - src/routes/build/BuildPage.tsx
parent_task_id: TASK-148
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the current Professional Identity import path that collapses everything into the synthetic identity-default vector. Build should derive its baseline workspace from Professional Identity, including real search vectors and identity-backed resume evidence, so identity becomes the primary authoring source for resume generation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Identity-to-resume derivation uses current Professional Identity data as the baseline Build source instead of a synthetic single-vector adapter.
- [x] #2 Identity search vectors are available as first-class Build vectors when present, with sensible fallback behavior when identity vectors are missing.
- [x] #3 Derived resume content includes identity-backed target lines, profiles, skills, roles, and projects in a way later vector selection and assembly tasks can consume.
- [x] #4 Import/export or launch flows that currently depend on the synthetic adapter continue to work or are intentionally migrated with clear behavior.
- [x] #5 Targeted tests cover identity derivation behavior and fallback cases.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect the current Professional Identity to ResumeData adapter and the Build workspace assumptions around vectors, target lines, profiles, skills, roles, and projects. 2. Replace the synthetic identity-default vector with identity-derived vectors from search_vectors when available, while preserving a sensible fallback when identity has no vectors. 3. Thread derived generation metadata into the imported workspace so later AI vector suggestion and dynamic generation tasks can build on the same baseline. 4. Add targeted tests for identity-derived vectors, content mapping, and fallback behavior, then run focused validation gates.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the synthetic identity-default import path with identity-derived resume vectors and generation metadata in src/identity/resumeAdapter.ts. The adapter now derives first-class Build vectors from identity search_vectors when present, keeps a fallback vector only when identity has no vectors, threads identity-backed target line variants and per-component vector priorities into the workspace, and deduplicates repeated vector ids without breaking import flows. Targeted tests in src/test/professionalIdentity.test.ts now cover the fallback path, multi-vector derivation, regex-safe alias handling, duplicate vector deduping, and unmatched-content fallback behavior. Verification: npx vitest run src/test/professionalIdentity.test.ts; npx eslint src/identity/resumeAdapter.ts src/test/professionalIdentity.test.ts; npm run typecheck; npm run build. Review artifacts: .agents/reviews/review-20260418-080107.md, .agents/reviews/review-20260418-080350-codex-fallback.md, and .agents/reviews/test-audit-20260418-080418.md. The bundled Claude review loop stayed noisy and contradictory across reruns, so closure is based on clean local gates plus the fresh-context fallback reviewer reporting no P0/P1 findings.
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
