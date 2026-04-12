---
id: TASK-102
title: Identity-first research and parameters doc initiative
status: Done
assignee: []
created_date: '2026-04-11 06:13'
updated_date: '2026-04-12 01:36'
labels:
  - feature
  - identity
  - research
milestone: m-16
dependencies: []
references:
  - src/routes/identity/IdentityPage.tsx
  - src/routes/research/ResearchPage.tsx
  - src/utils/searchProfileInference.ts
  - src/utils/jobMatch.ts
documentation:
  - main/facet/identity-to-parameters-doc-spec
  - main/facet/job-search-parameters-method
  - main/facet/professional-identity-schema-v3-1
  - main/facet/generator-rules-accuracy-gap-in-v3-1
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Recenter Research and the parameters-doc concept on Professional Identity as the single source of truth. Build the adapter and identity-first bootstrap first, then add structured editors for strategic fields in IdentityPage, then render the unified parameters-doc view from those fields without creating a parallel data layer.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Research can derive its working search inputs from the applied identity model without introducing a second durable source of truth.
- [ ] #2 Strategic identity fields needed for matching and research are intentionally populated through structured editing or explicit generation-review flows, not left as raw-JSON-only stubs.
- [ ] #3 IdentityPage includes a coherent parameters-doc view that renders the strategic and factual identity fields from the same underlying model.
- [ ] #4 Legacy SearchProfile duplication is either removed or explicitly reduced to session/run configuration after the identity-first path is proven.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
TASK-102.1 defines the identity-to-search adapter contract.
TASK-102.2 flips Research to identity-first bootstrap with resume fallback.
TASK-102.10 resolves the open schema question for interview-process criteria before structured strategic-preferences editing begins.
TASK-102.11 provides shared needs-review marker infrastructure for AI-derived strategic fields.
TASK-102.3, TASK-102.4, and TASK-102.5 populate the strategic identity fields through structured editors and explicit generation-review flows. These tasks share the IdentityPage surface and should be executed in close sequence by the same person or tightly coordinated team.
TASK-102.6 renders the parameters doc as an IdentityPage view over the same model.
TASK-102.7 and TASK-102.8 clean up remaining resume-shaped inference and duplicate long-lived SearchProfile state after the identity-first path is proven.
TASK-102.9 is future polish for standalone export and is intentionally last.

TASK-102.12 adds factual-correction persistence through generator_rules.accuracy so AI-derived regeneration and identity-native prompt flows inherit user-established truth constraints across sessions.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the identity-first research and parameters doc initiative end to end. Added an identity-to-search-profile adapter, moved Research bootstrap/inference to the identity path with resume fallback preservation, built the Identity strategy workbench for preferences, vectors, awareness, and parameters-doc export, added needs-review/evidence metadata for AI-derived identity items, and stopped identity-derived SearchProfile data from persisting as durable truth. Verification: targeted vitest slices passed during implementation, final `npm run test` passed with 95 files / 881 tests, and `npm run build` passed.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
